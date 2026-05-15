import type { Prisma } from "@prisma/client";

// Filter-types voor de veilingen-overzichtspagina (parallel aan listing-filters.ts).
// In sync met VeilingenFilterSidebar én buildAuctionFilterWhere onderaan.

export type AuctionType =
  | "SINGLE_CARD"
  | "MULTI_CARD"
  | "COLLECTION"
  | "SEALED_PRODUCT"
  | "OTHER";

export type AuctionDuration = 3 | 5 | 7 | 14;
export type AuctionSinceFilter = "today" | "week" | "month" | "all";
export type AuctionViewMode = "list" | "grid";

export const AUCTION_TYPES: AuctionType[] = [
  "SINGLE_CARD",
  "MULTI_CARD",
  "COLLECTION",
  "SEALED_PRODUCT",
  "OTHER",
];

export const AUCTION_TYPE_LABELS_NL: Record<AuctionType, string> = {
  SINGLE_CARD: "Enkele kaart",
  MULTI_CARD: "Meerdere kaarten",
  COLLECTION: "Collectie",
  SEALED_PRODUCT: "Sealed product",
  OTHER: "Overig",
};

// Auction-conditions zijn tekst-strings opgeslagen op Auction.condition. We
// hergebruiken dezelfde set als listings (consistent UX) — niet alle veilingen
// hebben een condition (MULTI_CARD/SEALED_PRODUCT/OTHER niet), maar het filter
// werkt nog steeds: matcht op de subset waar wel condition is.
export const AUCTION_CONDITION_OPTIONS: string[] = [
  "Mint",
  "Near Mint",
  "Excellent",
  "Good",
  "Light Played",
  "Played",
  "Poor",
];

export const AUCTION_DURATIONS: AuctionDuration[] = [3, 5, 7, 14];

export const AUCTION_RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;
export type AuctionRadius = (typeof AUCTION_RADIUS_OPTIONS)[number];

export interface AuctionFilters {
  view: AuctionViewMode;
  priceMin: number | null;
  priceMax: number | null;
  types: AuctionType[];
  conditions: string[];
  durations: AuctionDuration[];
  hasBuyNow: boolean;
  noReserve: boolean;
  hasBids: boolean | null; // true=heeft biedingen, false=nog geen biedingen, null=alles
  radius: AuctionRadius | null;
  verifiedOnly: boolean;
  since: AuctionSinceFilter;
}

function parseList<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T[] {
  if (!raw) return [];
  const set = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return allowed.filter((v) => set.has(v));
}

function parseNumberList<T extends number>(
  raw: string | undefined,
  allowed: readonly T[],
): T[] {
  if (!raw) return [];
  const nums = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const set = new Set(nums);
  return allowed.filter((v) => set.has(v));
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse auction-filters uit Next.js searchParams. Onbekende of ongeldige
 *  waardes vallen netjes terug op default. */
export function parseAuctionFilters(
  sp: Record<string, string | string[] | undefined>,
): AuctionFilters {
  function pick(key: string): string | undefined {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  }

  const view = pick("view") === "grid" ? "grid" : "list";
  const radiusRaw = parseNumber(pick("radius"));
  const radius =
    radiusRaw !== null &&
    (AUCTION_RADIUS_OPTIONS as readonly number[]).includes(radiusRaw)
      ? (radiusRaw as AuctionRadius)
      : null;

  const since = pick("since");
  const sinceFilter: AuctionSinceFilter =
    since === "today" || since === "week" || since === "month" ? since : "all";

  const hasBidsRaw = pick("has_bids");
  const hasBids: boolean | null =
    hasBidsRaw === "1" ? true : hasBidsRaw === "0" ? false : null;

  return {
    view,
    priceMin: parseNumber(pick("price_min")),
    priceMax: parseNumber(pick("price_max")),
    types: parseList(pick("type"), AUCTION_TYPES),
    conditions: parseList(pick("condition"), AUCTION_CONDITION_OPTIONS),
    durations: parseNumberList(pick("duration"), AUCTION_DURATIONS),
    hasBuyNow: pick("buy_now") === "1",
    noReserve: pick("no_reserve") === "1",
    hasBids,
    radius,
    verifiedOnly: pick("verified") === "1",
    since: sinceFilter,
  };
}

/** Build een Prisma-where fragment uit de filters. Combineer met je bestaande
 *  filters (status, country, blocking) via spread. Radius doet de page in JS
 *  (haversine, geen DB-spatial). */
export function buildAuctionFilterWhere(
  filters: AuctionFilters,
): Prisma.AuctionWhereInput {
  const where: Prisma.AuctionWhereInput = {};

  if (filters.priceMin !== null || filters.priceMax !== null) {
    where.currentBid = {};
    if (filters.priceMin !== null) where.currentBid.gte = filters.priceMin;
    if (filters.priceMax !== null) where.currentBid.lte = filters.priceMax;
  }

  if (filters.types.length > 0) {
    where.auctionType = { in: filters.types };
  }

  if (filters.conditions.length > 0) {
    where.condition = { in: filters.conditions };
  }

  if (filters.durations.length > 0) {
    where.duration = { in: filters.durations };
  }

  if (filters.hasBuyNow) {
    where.buyNowPrice = { not: null };
  }

  if (filters.noReserve) {
    // SQLite: null OF 0 → veilingen "zonder reserve"
    where.OR = [{ reservePrice: null }, { reservePrice: 0 }];
  }

  if (filters.hasBids === true) {
    where.bids = { some: {} };
  } else if (filters.hasBids === false) {
    where.bids = { none: {} };
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

/** Aantal actieve filters (excl. view + sort + page). Voor de filter-counter
 *  ("3 filters actief") en de "Wis filters"-knop. */
export function countActiveAuctionFilters(filters: AuctionFilters): number {
  let n = 0;
  if (filters.priceMin !== null) n++;
  if (filters.priceMax !== null) n++;
  if (filters.types.length > 0) n++;
  if (filters.conditions.length > 0) n++;
  if (filters.durations.length > 0) n++;
  if (filters.hasBuyNow) n++;
  if (filters.noReserve) n++;
  if (filters.hasBids !== null) n++;
  if (filters.radius !== null) n++;
  if (filters.verifiedOnly) n++;
  if (filters.since !== "all") n++;
  return n;
}
