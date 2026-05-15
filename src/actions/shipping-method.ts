"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireNotSuspended } from "@/lib/suspension";
import {
  getAvailableSlotsForOrigin,
  getBasePrice,
  validatePriceOverride,
  SHIPPING_ZONES,
  type ShippingService,
  type ShippingZone,
} from "@/lib/shipping/tariffs";
import {
  enrichMethod,
  isRequiredSlot,
  normalizeSellingScope,
  zonesInScope,
  type SellingScope,
} from "@/lib/shipping/static-methods";
import { sellingScopeSchema } from "@/lib/validations/shipping-method";
import { getCarriersForCountry } from "@/lib/shipping/carriers";

/**
 * Idempotente setup van statische verzendmethode-slots voor een seller (Fase 33).
 *
 * Voor elke (zone, service)-combinatie binnen de scope waarvoor basePrice bestaat:
 * - upsert een SellerShippingMethod-record (gegarandeerd uniek via @@unique([sellerId, service, zone]))
 * - bestaande priceOverride en carrier-keuze blijven behouden
 *
 * Slots BUITEN de scope worden op isActive=false gezet (priceOverride/carrier blijven bewaard
 * voor als seller scope weer uitbreidt).
 */
export async function setupStaticShippingMethods(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true, sellingCountries: true },
  });
  if (!user?.country) return; // skip users zonder origin-country

  const scope = normalizeSellingScope(user.sellingCountries);
  const allowedZones = new Set(zonesInScope(scope));
  const slots = getAvailableSlotsForOrigin(user.country);

  const carriers = getCarriersForCountry(user.country);
  const defaultCarrier = carriers[0]?.id ?? "OTHER";

  // Cleanup: verwijder slots met zones die niet meer bestaan in de huidige catalog
  // (bv. EU_FAR_ISLAND geschrapt in latere iteratie). Voorkomt stale rijen.
  await prisma.sellerShippingMethod.deleteMany({
    where: {
      sellerId: userId,
      service: { not: null },
      zone: { not: null, notIn: SHIPPING_ZONES as unknown as string[] },
    },
  });

  for (const slot of slots) {
    const inScope = allowedZones.has(slot.zone);
    await prisma.sellerShippingMethod.upsert({
      where: {
        sellerId_service_zone: {
          sellerId: userId,
          service: slot.service,
          zone: slot.zone,
        },
      },
      create: {
        sellerId: userId,
        service: slot.service,
        zone: slot.zone,
        carrier: defaultCarrier,
        isActive: inScope,
      },
      // Sync isActive aan scope — bij upgrade weer aanzetten, bij downgrade uit.
      // Carrier en priceOverride blijven bewaard zodat seller hun keuzes
      // niet kwijtraakt bij scope-toggling.
      update: { isActive: inScope },
    });
  }
}

export async function updateShippingSlot(
  id: string,
  patch: { carrier?: string; priceOverride?: number | null; isActive?: boolean },
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  await requireNotSuspended(session.user.id);

  const method = await prisma.sellerShippingMethod.findUnique({
    where: { id },
    include: { seller: { select: { country: true } } },
  });
  if (!method || method.sellerId !== session.user.id) {
    return { error: "Verzendmethode niet gevonden" };
  }
  if (!method.service || !method.zone || !method.seller.country) {
    return { error: "Slot niet ingericht — herlaad de pagina" };
  }

  const basePrice = getBasePrice(
    method.seller.country,
    method.zone as ShippingZone,
    method.service as ShippingService,
  );
  if (basePrice === null) {
    return { error: "Geen basisprijs beschikbaar voor deze combinatie" };
  }

  const data: { carrier?: string; priceOverride?: number | null; isActive?: boolean } = {};

  if (patch.carrier !== undefined) {
    const carriers = getCarriersForCountry(method.seller.country);
    if (!carriers.some((c) => c.id === patch.carrier)) {
      return { error: "Vervoerder niet beschikbaar in jouw land" };
    }
    data.carrier = patch.carrier;
  }

  if (patch.priceOverride !== undefined) {
    if (patch.priceOverride === null) {
      data.priceOverride = null;
    } else {
      const error = validatePriceOverride(patch.priceOverride, basePrice);
      if (error) return { error };
      data.priceOverride = Math.round(patch.priceOverride * 100) / 100;
    }
  }

  if (patch.isActive !== undefined) {
    data.isActive = patch.isActive;
  }

  await prisma.sellerShippingMethod.update({ where: { id }, data });
  revalidatePath("/dashboard/verzending");
  return { success: true };
}

export async function toggleShippingMethod(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const method = await prisma.sellerShippingMethod.findUnique({
    where: { id },
    include: { seller: { select: { sellingCountries: true } } },
  });
  if (!method || method.sellerId !== session.user.id) {
    return { error: "Verzendmethode niet gevonden" };
  }

  const scope = normalizeSellingScope(method.seller.sellingCountries);
  const inScopeZones = zonesInScope(scope);

  // Out-of-scope slots mogen niet ge-activeerd worden — anders consistency-conflict
  // tussen scope en actieve methodes. Seller moet eerst scope uitbreiden.
  if (
    !method.isActive &&
    method.zone &&
    !inScopeZones.includes(method.zone as ShippingZone)
  ) {
    return {
      error:
        "Deze zone valt buiten je verzendgebied — pas je verzendgebied aan om deze methode te activeren.",
    };
  }

  // Verplichte slot (PARCEL_SIGNED in in-scope zone) mag niet uit-getoggeld.
  if (
    method.isActive &&
    method.service &&
    method.zone &&
    isRequiredSlot(
      method.zone as ShippingZone,
      method.service as ShippingService,
      scope,
    )
  ) {
    return {
      error:
        "Aangetekende verzending is verplicht binnen je verzendgebied — pas je verzendgebied aan om deze methode uit te schakelen.",
    };
  }

  await prisma.sellerShippingMethod.update({
    where: { id },
    data: { isActive: !method.isActive },
  });
  revalidatePath("/dashboard/verzending");
  return { success: true, isActive: !method.isActive };
}

/** Lijst van actieve, statische slots voor een seller — verrijkt met catalog-data. */
export async function getSellerShippingMethods(sellerId?: string) {
  const session = await auth();
  const id = sellerId ?? session?.user?.id;
  if (!id) return [];

  const user = await prisma.user.findUnique({
    where: { id },
    select: { country: true },
  });
  if (!user?.country) return [];

  const methods = await prisma.sellerShippingMethod.findMany({
    where: { sellerId: id, service: { not: null }, zone: { not: null } },
    orderBy: [{ zone: "asc" }, { service: "asc" }],
  });

  return methods
    .map((m) => {
      const enriched = enrichMethod(m, user.country!);
      return enriched ? { ...enriched, raw: m } : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
}

export async function updateSellingScope(input: { scope: SellingScope }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  await requireNotSuspended(session.user.id);

  const result = sellingScopeSchema.safeParse(input);
  if (!result.success) return { error: "Ongeldige keuze" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { sellingCountries: result.data.scope },
  });

  // Sync slot-actief-staat aan nieuwe scope
  await setupStaticShippingMethods(session.user.id);

  revalidatePath("/dashboard/verzending");
  return { success: true };
}

export async function getSellingScope(): Promise<SellingScope> {
  const session = await auth();
  if (!session?.user?.id) return "DOMESTIC_AND_NEAR";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { sellingCountries: true },
  });

  return normalizeSellingScope(user?.sellingCountries);
}
