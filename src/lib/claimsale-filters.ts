import type { Prisma } from "@prisma/client";

// Filter-types voor de claimsales-overzichtspagina (parallel aan listing-filters
// en auction-filters). In sync met ClaimsalesFilterSidebar.

export type ClaimsaleSinceFilter = "today" | "week" | "month" | "all";
export type ClaimsaleViewMode = "list" | "grid";

// Conditions zijn opgeslagen op ClaimsaleItem.condition. Filter checkt of er
// minstens één AVAILABLE item is met de gekozen conditie — een claimsale met
// 50 items waarvan 1 Mint past dus in de "Mint"-filter.
export const CLAIMSALE_CONDITION_OPTIONS: string[] = [
  "Mint",
  "Near Mint",
  "Excellent",
  "Good",
  "Light Played",
  "Played",
  "Poor",
];

// Aantal-items buckets — handig om grote-claimsale-grabbag's los te filteren
// van losse 1-3 items sales. We slaan minimum-aantallen op.
export const ITEM_COUNT_OPTIONS = [5, 10, 25, 50] as const;
export type ItemCountMin = (typeof ITEM_COUNT_OPTIONS)[number];

export const CLAIMSALE_RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;
export type ClaimsaleRadius = (typeof CLAIMSALE_RADIUS_OPTIONS)[number];

export interface ClaimsaleFilters {
  view: ClaimsaleViewMode;
  /** Minimum item-prijs binnen de sale. Sale matcht als minstens één
   *  AVAILABLE item ≥ priceMin is. */
  priceMin: number | null;
  /** Maximum item-prijs binnen de sale. Sale matcht als minstens één
   *  AVAILABLE item ≤ priceMax is. */
  priceMax: number | null;
  conditions: string[];
  itemCountMin: ItemCountMin | null;
  radius: ClaimsaleRadius | null;
  verifiedOnly: boolean;
  since: ClaimsaleSinceFilter;
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

export function parseClaimsaleFilters(
  sp: Record<string, string | string[] | undefined>,
): ClaimsaleFilters {
  function pick(key: string): string | undefined {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  }

  const view = pick("view") === "grid" ? "grid" : "list";
  const radiusRaw = parseNumber(pick("radius"));
  const radius =
    radiusRaw !== null &&
    (CLAIMSALE_RADIUS_OPTIONS as readonly number[]).includes(radiusRaw)
      ? (radiusRaw as ClaimsaleRadius)
      : null;

  const itemCountRaw = parseNumber(pick("min_items"));
  const itemCountMin =
    itemCountRaw !== null &&
    (ITEM_COUNT_OPTIONS as readonly number[]).includes(itemCountRaw)
      ? (itemCountRaw as ItemCountMin)
      : null;

  const since = pick("since");
  const sinceFilter: ClaimsaleSinceFilter =
    since === "today" || since === "week" || since === "month" ? since : "all";

  return {
    view,
    priceMin: parseNumber(pick("price_min")),
    priceMax: parseNumber(pick("price_max")),
    conditions: parseList(pick("condition"), CLAIMSALE_CONDITION_OPTIONS),
    itemCountMin,
    radius,
    verifiedOnly: pick("verified") === "1",
    since: sinceFilter,
  };
}

/** Build een Prisma-where fragment uit de filters. Het prijs-filter werkt op
 *  ClaimsaleItem-niveau (sale telt als match wanneer minstens één AVAILABLE
 *  item binnen de range valt). itemCountMin gebruikt een directe count via
 *  een raw `items` relation-filter. Radius doet de page in JS (haversine). */
export function buildClaimsaleFilterWhere(
  filters: ClaimsaleFilters,
): Prisma.ClaimsaleWhereInput {
  const where: Prisma.ClaimsaleWhereInput = {};

  // Prijs- en conditie-filter — beide op AVAILABLE-items van de sale.
  // Combineer in één items.some-clause zodat het dezelfde items moet matchen
  // (anders zou je een Mint-conditie sale aan een dure non-Mint item kunnen
  // matchen).
  const itemConditions: Prisma.ClaimsaleItemWhereInput = { status: "AVAILABLE" };
  if (filters.priceMin !== null || filters.priceMax !== null) {
    itemConditions.price = {};
    if (filters.priceMin !== null) itemConditions.price.gte = filters.priceMin;
    if (filters.priceMax !== null) itemConditions.price.lte = filters.priceMax;
  }
  if (filters.conditions.length > 0) {
    itemConditions.condition = { in: filters.conditions };
  }
  // Alleen toepassen als er minstens één van de prijs/conditie-filters actief is.
  const hasItemFilter =
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.conditions.length > 0;
  if (hasItemFilter) {
    where.items = { some: itemConditions };
  }

  if (filters.verifiedOnly) {
    where.seller = { ...(where.seller ?? {}), isVerified: true };
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
    where.publishedAt = { gte: cutoff };
  }

  // itemCountMin wordt post-filter in de page gedaan want SQLite kan niet
  // direct op _count.items filteren via Prisma's WHERE clause.

  return where;
}

export function countActiveClaimsaleFilters(filters: ClaimsaleFilters): number {
  let n = 0;
  if (filters.priceMin !== null) n++;
  if (filters.priceMax !== null) n++;
  if (filters.conditions.length > 0) n++;
  if (filters.itemCountMin !== null) n++;
  if (filters.radius !== null) n++;
  if (filters.verifiedOnly) n++;
  if (filters.since !== "all") n++;
  return n;
}
