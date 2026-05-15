/**
 * Statische verzendcatalog (Fase 33).
 *
 * Twee-laags model:
 * 1. DOMESTIC_TARIFFS_BY_COUNTRY — landspecifieke tarieven voor 16 landen waar we 2025/2026-data hebben.
 * 2. DOMESTIC_TIER_FALLBACKS — regio-tier-fallback voor de overige 11 EU-landen.
 *
 * Cross-border tarieven zijn niet origin-specifiek: pan-EU carriers (DPD/GLS/DHL) prijzen vrijwel
 * identiek per route ongeacht origin. Eén tarief per zone (EU_NEAR / EU_FAR).
 *
 * Sellers kunnen via priceOverride ±50% rond de basisprijs aanpassen.
 */

export type ShippingService = "MAILBOX_PARCEL" | "PARCEL_STANDARD" | "PARCEL_SIGNED";
export type ShippingZone = "DOMESTIC" | "EU_NEAR" | "EU_FAR";

export const SHIPPING_SERVICES: readonly ShippingService[] = [
  "MAILBOX_PARCEL",
  "PARCEL_STANDARD",
  "PARCEL_SIGNED",
] as const;

export const SHIPPING_ZONES: readonly ShippingZone[] = [
  "DOMESTIC",
  "EU_NEAR",
  "EU_FAR",
] as const;

export const PRICE_OVERRIDE_TOLERANCE = 0.50; // ±50%
const TOLERANCE_EPSILON = 0.001; // numerieke afronding

type ServicePriceMap = Partial<Record<ShippingService, number>>;

/** Landspecifieke DOMESTIC-tarieven (2025/2026-data, zie plan-doc voor bronnen). */
const DOMESTIC_TARIFFS_BY_COUNTRY: Record<string, ServicePriceMap> = {
  NL: { MAILBOX_PARCEL: 5.50, PARCEL_STANDARD: 7.85, PARCEL_SIGNED: 10.95 },
  BE: { MAILBOX_PARCEL: 5.20, PARCEL_STANDARD: 7.50, PARCEL_SIGNED: 10.50 },
  DE: { MAILBOX_PARCEL: 4.50, PARCEL_STANDARD: 6.99, PARCEL_SIGNED: 9.95 },
  FR: { MAILBOX_PARCEL: 5.00, PARCEL_STANDARD: 8.50, PARCEL_SIGNED: 11.50 },
  AT: { PARCEL_STANDARD: 7.68, PARCEL_SIGNED: 11.00 },
  IE: { PARCEL_STANDARD: 9.00, PARCEL_SIGNED: 13.00 },
  LU: { PARCEL_STANDARD: 7.20, PARCEL_SIGNED: 10.50 },
  FI: { PARCEL_STANDARD: 8.90, PARCEL_SIGNED: 12.50 },
  IT: { PARCEL_STANDARD: 10.30, PARCEL_SIGNED: 14.50 },
  ES: { PARCEL_STANDARD: 9.50, PARCEL_SIGNED: 18.05 },
  SI: { PARCEL_STANDARD: 3.40, PARCEL_SIGNED: 5.50 },
  SK: { PARCEL_STANDARD: 3.00, PARCEL_SIGNED: 5.00 },
  HR: { PARCEL_STANDARD: 5.20, PARCEL_SIGNED: 7.50 },
  EE: { PARCEL_STANDARD: 3.50, PARCEL_SIGNED: 5.50 },
  LV: { PARCEL_STANDARD: 3.50, PARCEL_SIGNED: 5.50 },
  LT: { PARCEL_STANDARD: 3.50, PARCEL_SIGNED: 5.50 },
};

type FallbackTier = "NORTHERN" | "SOUTHERN" | "EASTERN";

const TIER_BY_COUNTRY: Record<string, FallbackTier> = {
  DK: "NORTHERN", SE: "NORTHERN",
  PT: "SOUTHERN", GR: "SOUTHERN", MT: "SOUTHERN", CY: "SOUTHERN",
  PL: "EASTERN", CZ: "EASTERN", HU: "EASTERN", RO: "EASTERN", BG: "EASTERN",
};

const DOMESTIC_TIER_FALLBACKS: Record<FallbackTier, ServicePriceMap> = {
  NORTHERN: { PARCEL_STANDARD: 8.50, PARCEL_SIGNED: 12.00 },
  SOUTHERN: { PARCEL_STANDARD: 7.50, PARCEL_SIGNED: 11.00 },
  EASTERN: { PARCEL_STANDARD: 4.50, PARCEL_SIGNED: 7.00 },
};

/** Cross-border tarieven, geldig vanuit elke origin. */
const CROSS_BORDER_TARIFFS: Record<Exclude<ShippingZone, "DOMESTIC">, ServicePriceMap> = {
  EU_NEAR: { PARCEL_STANDARD: 9.50, PARCEL_SIGNED: 13.50 },
  EU_FAR: { PARCEL_STANDARD: 14.50, PARCEL_SIGNED: 18.50 },
};

/** Returnt de DOMESTIC-basisprijs voor een seller in `country`, of null als die service niet beschikbaar
 *  is in dat land (bv. MAILBOX_PARCEL alleen in NL/BE/DE/FR). */
export function getDomesticBasePrice(country: string, service: ShippingService): number | null {
  const direct = DOMESTIC_TARIFFS_BY_COUNTRY[country];
  if (direct && service in direct) return direct[service] ?? null;

  const tier = TIER_BY_COUNTRY[country];
  if (!tier) return null;
  return DOMESTIC_TIER_FALLBACKS[tier][service] ?? null;
}

export function getCrossBorderBasePrice(
  zone: Exclude<ShippingZone, "DOMESTIC">,
  service: ShippingService,
): number | null {
  return CROSS_BORDER_TARIFFS[zone][service] ?? null;
}

/** Eén entry-point: bepaal basisprijs voor een (origin, zone, service)-combinatie. */
export function getBasePrice(
  originCountry: string,
  zone: ShippingZone,
  service: ShippingService,
): number | null {
  if (zone === "DOMESTIC") return getDomesticBasePrice(originCountry, service);
  return getCrossBorderBasePrice(zone, service);
}

/** Min/max grenzen voor priceOverride, afgerond op cent. */
export function getMinMaxOverride(basePrice: number): { min: number; max: number } {
  const min = Math.round(basePrice * (1 - PRICE_OVERRIDE_TOLERANCE) * 100) / 100;
  const max = Math.round(basePrice * (1 + PRICE_OVERRIDE_TOLERANCE) * 100) / 100;
  return { min, max };
}

/** Server-side check voor priceOverride. Retourneert null als valid, anders een error-string. */
export function validatePriceOverride(override: number, basePrice: number): string | null {
  if (override <= 0) return "Prijs moet positief zijn";
  const ratio = Math.abs(override - basePrice) / basePrice;
  if (ratio > PRICE_OVERRIDE_TOLERANCE + TOLERANCE_EPSILON) {
    const { min, max } = getMinMaxOverride(basePrice);
    return `Prijs moet tussen €${min.toFixed(2)} en €${max.toFixed(2)} liggen`;
  }
  return null;
}

/** Lijst van alle (zone, service)-combinaties die basisprijs hebben voor een origin.
 *  Gebruikt door setupStaticShippingMethods om te bepalen welke slots aan te leggen. */
export function getAvailableSlotsForOrigin(
  originCountry: string,
): Array<{ zone: ShippingZone; service: ShippingService; basePrice: number }> {
  const slots: Array<{ zone: ShippingZone; service: ShippingService; basePrice: number }> = [];
  for (const zone of SHIPPING_ZONES) {
    for (const service of SHIPPING_SERVICES) {
      const price = getBasePrice(originCountry, zone, service);
      if (price !== null) slots.push({ zone, service, basePrice: price });
    }
  }
  return slots;
}
