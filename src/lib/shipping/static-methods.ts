/**
 * Statische verzendmethode-helpers (Fase 33).
 *
 * Bridge tussen DB-records (`SellerShippingMethod`) en de tariff-catalog. Levert per-slot
 * `effectivePrice` (priceOverride of basePrice), filtering op selling-scope, en service-labels.
 */

import type { SellerShippingMethod } from "@prisma/client";
import {
  getBasePrice,
  type ShippingService,
  type ShippingZone,
} from "./tariffs";

export type SellingScope = "DOMESTIC_ONLY" | "DOMESTIC_AND_NEAR" | "ALL_EU";

export const SELLING_SCOPES: readonly SellingScope[] = [
  "DOMESTIC_ONLY",
  "DOMESTIC_AND_NEAR",
  "ALL_EU",
] as const;

export function isSellingScope(value: string): value is SellingScope {
  return SELLING_SCOPES.includes(value as SellingScope);
}

/** Map legacy `User.sellingCountries` waardes naar de nieuwe scope-set. */
export function normalizeSellingScope(value: string | null | undefined): SellingScope {
  if (!value) return "DOMESTIC_AND_NEAR";
  if (isSellingScope(value)) return value;
  // Legacy mapping
  if (value === "NL_ONLY") return "DOMESTIC_ONLY";
  if (value === "NL_BE") return "DOMESTIC_AND_NEAR";
  if (value === "ALL_EU") return "ALL_EU";
  return "DOMESTIC_AND_NEAR";
}

/** Welke zones zijn binnen scope? */
export function zonesInScope(scope: SellingScope): ShippingZone[] {
  if (scope === "DOMESTIC_ONLY") return ["DOMESTIC"];
  if (scope === "DOMESTIC_AND_NEAR") return ["DOMESTIC", "EU_NEAR"];
  return ["DOMESTIC", "EU_NEAR", "EU_FAR"];
}

/** PARCEL_SIGNED is verplicht actief in elke in-scope zone. Het is de fallback-methode
 *  voor orders ≥€150 (waar SIGNED-only filter geldt in checkout). Zonder zou een buyer
 *  met een hoog-bedrag-order geen verzendoptie kunnen kiezen. */
export function isRequiredSlot(
  zone: ShippingZone,
  service: ShippingService,
  scope: SellingScope,
): boolean {
  if (service !== "PARCEL_SIGNED") return false;
  return zonesInScope(scope).includes(zone);
}

/** Effectieve prijs voor een seller's slot. priceOverride heeft voorrang op basePrice. */
export function getEffectivePrice(
  method: Pick<SellerShippingMethod, "service" | "zone" | "priceOverride">,
  sellerCountry: string,
): number | null {
  if (!method.service || !method.zone) return null;
  const base = getBasePrice(
    sellerCountry,
    method.zone as ShippingZone,
    method.service as ShippingService,
  );
  if (base === null) return null;
  return method.priceOverride ?? base;
}

/** Leid de set verzendmethode-ids af die voor een listing/auction gelden.
 *
 *  Vereenvoudigde regels (post-Fase-33 v2):
 *  - PARCEL_STANDARD + PARCEL_SIGNED zijn ALTIJD inbegrepen (alle actieve seller-slots).
 *    Sellers kunnen hier niet uit opt-outen per listing — beheer is per-account
 *    via /dashboard/verzending.
 *  - MAILBOX_PARCEL is opt-in per listing (allowMailbox), alleen voor SINGLE_CARD
 *    en MULTI_CARD types, en alleen wanneer prijs < €150 (anti-fraude).
 */
export async function deriveListingShippingMethodIds(args: {
  prisma: import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient;
  sellerId: string;
  allowMailbox: boolean;
  listingType: string;
  price: number | null;
  mailboxEligible: (t: string) => boolean;
}): Promise<string[]> {
  const { prisma, sellerId, allowMailbox, listingType, price, mailboxEligible } = args;
  const methods = await prisma.sellerShippingMethod.findMany({
    where: { sellerId, isActive: true },
    select: { id: true, service: true },
  });

  const allowMailboxFinal =
    allowMailbox && mailboxEligible(listingType) && (price === null || price < 150);

  return methods
    .filter((m) => {
      if (m.service === "PARCEL_STANDARD" || m.service === "PARCEL_SIGNED") return true;
      if (m.service === "MAILBOX_PARCEL") return allowMailboxFinal;
      return false;
    })
    .map((m) => m.id);
}

/** Verrijkt een DB-method met catalog-context (basePrice, effectivePrice, min/max). */
export function enrichMethod(
  method: SellerShippingMethod,
  sellerCountry: string,
): {
  id: string;
  service: ShippingService;
  zone: ShippingZone;
  carrier: string;
  basePrice: number;
  effectivePrice: number;
  priceOverride: number | null;
  isActive: boolean;
} | null {
  if (!method.service || !method.zone) return null;
  const service = method.service as ShippingService;
  const zone = method.zone as ShippingZone;
  const basePrice = getBasePrice(sellerCountry, zone, service);
  if (basePrice === null) return null;
  const effectivePrice = method.priceOverride ?? basePrice;
  return {
    id: method.id,
    service,
    zone,
    carrier: method.carrier,
    basePrice,
    effectivePrice,
    priceOverride: method.priceOverride,
    isActive: method.isActive,
  };
}
