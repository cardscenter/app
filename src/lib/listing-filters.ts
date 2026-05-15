import type { Prisma } from "@prisma/client";

// Alle filter-types die de marktplaats-sidebar ondersteunt. Houden in sync
// met de UI in MarktplaatsFilterSidebar én met de Prisma-where-builder onderaan.
export type ListingType =
  | "SINGLE_CARD"
  | "MULTI_CARD"
  | "COLLECTION"
  | "SEALED_PRODUCT"
  | "OTHER";

export type ListingPricingMode = "DIRECT" | "OFFER";
export type ListingDeliveryMode = "SHIP" | "PICKUP";
export type ListingSinceFilter = "today" | "week" | "month" | "all";
export type ListingViewMode = "list" | "grid";

export const LISTING_TYPES: ListingType[] = [
  "SINGLE_CARD",
  "MULTI_CARD",
  "COLLECTION",
  "SEALED_PRODUCT",
  "OTHER",
];

export const LISTING_TYPE_LABELS_NL: Record<ListingType, string> = {
  SINGLE_CARD: "Enkele kaart",
  MULTI_CARD: "Meerdere kaarten",
  COLLECTION: "Collectie",
  SEALED_PRODUCT: "Sealed product",
  OTHER: "Overig",
};

// Conditions matching wat in step-details.tsx wordt aangeboden — de exacte
// strings worden 1-op-1 in Listing.condition opgeslagen.
export const CONDITION_OPTIONS: string[] = [
  "Mint",
  "Near Mint",
  "Excellent",
  "Good",
  "Light Played",
  "Played",
  "Poor",
];

export const RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;
export type Radius = (typeof RADIUS_OPTIONS)[number];

export interface ListingFilters {
  view: ListingViewMode;
  priceMin: number | null;
  priceMax: number | null;
  types: ListingType[];
  conditions: string[];
  pricingModes: ListingPricingMode[];
  deliveryModes: ListingDeliveryMode[];
  freeShipping: boolean;
  radius: Radius | null;
  verifiedOnly: boolean;
  since: ListingSinceFilter;
}

function parseList<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T[] {
  if (!raw) return [];
  const set = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return allowed.filter((v) => set.has(v));
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse listing-filters uit een Next.js searchParams object. Onbekende of
 *  ongeldige waardes vallen netjes terug op default. */
export function parseListingFilters(
  sp: Record<string, string | string[] | undefined>,
): ListingFilters {
  function pick(key: string): string | undefined {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  }

  const view = pick("view") === "grid" ? "grid" : "list";
  const radiusRaw = parseNumber(pick("radius"));
  const radius =
    radiusRaw !== null && (RADIUS_OPTIONS as readonly number[]).includes(radiusRaw)
      ? (radiusRaw as Radius)
      : null;

  const since = pick("since");
  const sinceFilter: ListingSinceFilter =
    since === "today" || since === "week" || since === "month" ? since : "all";

  return {
    view,
    priceMin: parseNumber(pick("price_min")),
    priceMax: parseNumber(pick("price_max")),
    types: parseList(pick("type"), LISTING_TYPES),
    conditions: parseList(pick("condition"), CONDITION_OPTIONS),
    pricingModes: parseList(pick("pricing"), ["DIRECT", "OFFER"] as const),
    deliveryModes: parseList(pick("delivery"), ["SHIP", "PICKUP"] as const),
    freeShipping: pick("free_shipping") === "1",
    radius,
    verifiedOnly: pick("verified") === "1",
    since: sinceFilter,
  };
}

/** Build een Prisma-where fragment uit de filters. Combineer dit met je
 *  bestaande filters (status, country, blocking) via spread. NIET gebruikt:
 *  radius — die kan SQLite niet (geen haversine), wordt na de fetch in JS
 *  toegepast door de page. */
export function buildListingFilterWhere(
  filters: ListingFilters,
): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = {};

  if (filters.priceMin !== null || filters.priceMax !== null) {
    where.price = {};
    if (filters.priceMin !== null) where.price.gte = filters.priceMin;
    if (filters.priceMax !== null) where.price.lte = filters.priceMax;
  }

  if (filters.types.length > 0) {
    where.listingType = { in: filters.types };
  }

  if (filters.conditions.length > 0) {
    where.condition = { in: filters.conditions };
  }

  // Pricing-mode → pricingType + allowDirectBuy/acceptsOffers.
  // DIRECT = FIXED met allowDirectBuy=true; OFFER = NEGOTIABLE OF FIXED met
  // acceptsOffers=true. Als beide aangevinkt: geen filter (alle koop-vormen).
  if (filters.pricingModes.length === 1) {
    if (filters.pricingModes[0] === "DIRECT") {
      where.pricingType = "FIXED";
      where.allowDirectBuy = true;
    } else {
      where.OR = [
        { pricingType: "NEGOTIABLE" },
        { pricingType: "FIXED", acceptsOffers: true },
      ];
    }
  }

  // Delivery: SHIP → deliveryMethod in [SHIP, BOTH]; PICKUP → in [PICKUP, BOTH].
  // Beide aangevinkt: geen filter.
  if (filters.deliveryModes.length === 1) {
    if (filters.deliveryModes[0] === "SHIP") {
      where.deliveryMethod = { in: ["SHIP", "BOTH"] };
    } else {
      where.deliveryMethod = { in: ["PICKUP", "BOTH"] };
    }
  }

  if (filters.freeShipping) {
    where.freeShipping = true;
  }

  if (filters.verifiedOnly) {
    where.seller = { isVerified: true };
  }

  if (filters.since !== "all") {
    const now = new Date();
    let cutoff: Date;
    if (filters.since === "today") {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (filters.since === "week") {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    where.createdAt = { gte: cutoff };
  }

  return where;
}

/** Aantal actieve filters (excl. view + sort + page). Gebruikt voor de
 *  filter-counter in de UI ("3 filters actief") en de "Wis filters"-knop. */
export function countActiveFilters(filters: ListingFilters): number {
  let n = 0;
  if (filters.priceMin !== null) n++;
  if (filters.priceMax !== null) n++;
  if (filters.types.length > 0) n++;
  if (filters.conditions.length > 0) n++;
  if (filters.pricingModes.length > 0) n++;
  if (filters.deliveryModes.length > 0) n++;
  if (filters.freeShipping) n++;
  if (filters.radius !== null) n++;
  if (filters.verifiedOnly) n++;
  if (filters.since !== "all") n++;
  return n;
}
