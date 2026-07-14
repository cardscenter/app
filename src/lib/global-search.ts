import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getBuyerLocation, getSellerCountryFilter } from "@/lib/shipping/filter";
import { getBlockedUserIds, sellerNotInBlockedFilter } from "@/lib/blocking";
import { buildCardSearchWhere, normalizeForSearch } from "@/lib/search-utils";
import { getCardImageUrl } from "@/lib/card-image";
import { getMarktprijs } from "@/lib/display-price";
import { cardSlug } from "@/lib/card-helpers";
import { listAllSpecies, dexIdFromUrl } from "@/lib/pokeapi/client";
import { pokedexSlug } from "@/lib/pokeapi/slug";
import { parseImageUrls } from "@/lib/upload";

/**
 * Centrale query-laag voor de globale zoekfunctie: header-suggesties
 * (/api/search/suggest) én de /zoeken-resultatenpagina. Vier categorieën:
 * kaarten (Card-database), Pokémon (PokéAPI-cache), aanbod
 * (veilingen/claimsales/advertenties) en gebruikers.
 */

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Types per categorie
// ---------------------------------------------------------------------------

export interface CardHit {
  id: string;
  name: string;
  localId: string;
  rarity: string | null;
  setName: string;
  setSlug: string;
  imageUrl: string | null;
  price: number | null;
  href: string;
}

export interface PokemonHit {
  dexId: number;
  name: string; // raw PokéAPI name ("mr-mime")
  displayName: string; // "Mr Mime"
  spriteUrl: string;
  href: string;
}

export interface SearchResult {
  id: string;
  type: "auction" | "claimsale" | "listing";
  title: string;
  price: number | null;
  sellerName: string;
  createdAt: string;
  // auction-specific
  endTime?: string;
  bidCount?: number;
  auctionType?: string;
  currentBid?: number | null;
  startingBid?: number;
  buyNowPrice?: number | null;
  imageUrls?: string | null;
  // claimsale-specific
  itemCount?: number;
  priceRange?: { min: number; max: number } | null;
  shippingCost?: number;
  totalItems?: number;
  // listing-specific
  cardName?: string;
  condition?: string;
  pricingType?: string;
}

export interface UserHit {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  accountKind: string;
  isVerified: boolean;
  createdAt: string;
  href: string;
}

export interface SupplyFilters {
  type?: "auction" | "claimsale" | "listing";
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "ending_soon" | "most_bids";
}

export interface SupplyGuards {
  /** Fase 33 selling-scope: `{ seller: { OR: [...] } }` of `{}` voor anoniem. */
  countryFilter: ReturnType<typeof getSellerCountryFilter>;
  /** `{ sellerId: { notIn } }` of `{}` — symmetrische blokkades. */
  blockingWhere: { sellerId: { notIn: string[] } } | Record<string, never>;
  /** Voor de gebruikers-categorie: geblokkeerde IDs allebei richtingen. */
  blockedIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Guards (1× per request opbouwen en aan alle query-fns doorgeven)
// ---------------------------------------------------------------------------

export async function getSupplyGuards(): Promise<SupplyGuards> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const [location, blockedIds] = await Promise.all([
    getBuyerLocation(),
    getBlockedUserIds(userId),
  ]);
  const sellerFilter = sellerNotInBlockedFilter(blockedIds);
  return {
    countryFilter: getSellerCountryFilter(location?.country ?? null),
    blockingWhere: sellerFilter ? { sellerId: sellerFilter } : {},
    blockedIds,
  };
}

// ---------------------------------------------------------------------------
// Kaarten (Card-database)
// ---------------------------------------------------------------------------

/** Zelfde soft-cap als /api/cards/search: boven dit aantal vragen we de
 *  gebruiker te verfijnen i.p.v. honderden rijen te scoren. */
const CARD_MAX_RESULTS = 300;

type FullCardRow = Prisma.CardGetPayload<{
  include: {
    cardSet: { select: { name: true; tcgdexSetId: true; releaseDate: true } };
  };
}>;

function scoreAndSortCards(cards: FullCardRow[], q: string): FullCardRow[] {
  const normalizedQuery = normalizeForSearch(q);
  const scored = cards.map((c) => {
    const sn = c.searchName ?? normalizeForSearch(c.name);
    let score = 10;
    if (sn === normalizedQuery) score = 100;
    else if (sn.startsWith(normalizedQuery)) score = 80;
    else if (sn.includes(normalizedQuery)) score = 50;
    return { card: c, score };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.card.cardSet.releaseDate ?? "0000-00-00";
    const db = b.card.cardSet.releaseDate ?? "0000-00-00";
    return db.localeCompare(da);
  });
  return scored.map((s) => s.card);
}

function toCardHit(card: FullCardRow): CardHit {
  return {
    id: card.id,
    name: card.name,
    localId: card.localId,
    rarity: card.rarity,
    setName: card.cardSet.name,
    setSlug: card.cardSet.tcgdexSetId ?? "",
    imageUrl: getCardImageUrl(card, "low"),
    price: getMarktprijs(card),
    href: `/kaarten/${card.cardSet.tcgdexSetId}/${cardSlug(card.name, card.localId)}`,
  };
}

export async function searchCards(
  q: string,
  opts: { page?: number; pageSize?: number; minPrice?: number; maxPrice?: number } = {}
): Promise<Paged<CardHit> & { tooBroad: boolean }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 24;

  const where = buildCardSearchWhere(q);
  const extraClauses: Array<Record<string, unknown>> = [];
  if (opts.minPrice != null) extraClauses.push({ priceAvg: { gte: opts.minPrice } });
  if (opts.maxPrice != null) extraClauses.push({ priceAvg: { lte: opts.maxPrice } });
  if (extraClauses.length > 0) {
    where.AND = [...((where.AND as Array<Record<string, unknown>>) ?? []), ...extraClauses];
  }

  const total = await prisma.card.count({ where });
  if (total > CARD_MAX_RESULTS) {
    return { items: [], total, page, totalPages: 0, tooBroad: true };
  }
  if (total === 0) {
    return { items: [], total: 0, page, totalPages: 0, tooBroad: false };
  }

  const cards = await prisma.card.findMany({
    where,
    include: {
      cardSet: { select: { name: true, tcgdexSetId: true, releaseDate: true } },
    },
  });

  // Kaarten zonder set-slug kunnen niet gelinkt worden — filter defensief.
  const sorted = scoreAndSortCards(cards, q).filter((c) => c.cardSet.tcgdexSetId);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const items = sorted
    .slice((page - 1) * pageSize, page * pageSize)
    .map((c) => toCardHit(c));

  return { items, total: sorted.length, page, totalPages, tooBroad: false };
}

export async function countCards(q: string): Promise<number> {
  return prisma.card.count({ where: buildCardSearchWhere(q) });
}

// ---------------------------------------------------------------------------
// Pokémon (PokéAPI species-cache, geen DB)
// ---------------------------------------------------------------------------

/** Zelfde normalisatie als /pokedex: "Mr. Mime" / "mr-mime" / "mrmime" matchen. */
function normalizePokemonName(s: string): string {
  return s.toLowerCase().replace(/[\s\-.]+/g, "");
}

function pokemonTitleCase(s: string): string {
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function pokemonSpriteUrl(dexId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
}

async function filterPokemon(q: string): Promise<PokemonHit[] | null> {
  const all = await listAllSpecies();
  if (!all) return null; // PokéAPI down
  const nq = normalizePokemonName(q);
  return all.results
    .map((s) => {
      const dexId = dexIdFromUrl(s.url);
      // Vormen/test-rijen boven 10000 hebben geen sprite → overslaan.
      return dexId && dexId < 10_000 ? { name: s.name, dexId } : null;
    })
    .filter((x): x is { name: string; dexId: number } => x !== null)
    .filter((p) => normalizePokemonName(p.name).includes(nq))
    .sort((a, b) => a.dexId - b.dexId)
    .map((p) => ({
      dexId: p.dexId,
      name: p.name,
      displayName: pokemonTitleCase(p.name),
      spriteUrl: pokemonSpriteUrl(p.dexId),
      href: `/pokedex/${pokedexSlug(p.name, p.dexId)}`,
    }));
}

export async function searchPokemon(
  q: string,
  opts: { page?: number; pageSize?: number } = {}
): Promise<Paged<PokemonHit> & { unavailable: boolean }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 24;
  const filtered = await filterPokemon(q);
  if (!filtered) {
    return { items: [], total: 0, page, totalPages: 0, unavailable: true };
  }
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    totalPages,
    unavailable: false,
  };
}

// ---------------------------------------------------------------------------
// Aanbod (veilingen / claimsales / advertenties)
// ---------------------------------------------------------------------------

/** Per entiteit maximaal zoveel rijen mergen. Cross-entity paginering over
 *  drie tabellen is anders niet betrouwbaar te sorteren; boven de cap tonen
 *  we een "verfijn je zoekopdracht"-hint. */
const SUPPLY_MERGE_CAP = 100;

function buildSupplyWheres(q: string, filters: SupplyFilters, guards: SupplyGuards) {
  const query = q.trim();
  const priceRange =
    filters.minPrice != null || filters.maxPrice != null
      ? {
          ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
          ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
        }
      : null;

  const textConditions = query
    ? {
        OR: [
          { title: { contains: query } },
          { cardName: { contains: query } },
          { description: { contains: query } },
        ],
      }
    : {};

  const auctionWhere = {
    status: "ACTIVE",
    ...textConditions,
    ...(filters.condition ? { condition: filters.condition } : {}),
    ...guards.blockingWhere,
    ...guards.countryFilter,
    // Prijsfilter in AND zodat de OR niet botst met de tekst-OR. Veilingen
    // zonder bod vallen terug op startingBid zodat ze niet stil wegvallen.
    ...(priceRange
      ? {
          AND: [
            {
              OR: [
                { currentBid: priceRange },
                { currentBid: null, startingBid: priceRange },
              ],
            },
          ],
        }
      : {}),
  };

  const claimsaleWhere = {
    status: "LIVE",
    ...(query
      ? {
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { items: { some: { cardName: { contains: query } } } },
          ],
        }
      : {}),
    ...guards.blockingWhere,
    ...guards.countryFilter,
    ...(filters.condition || priceRange
      ? {
          items: {
            some: {
              status: "AVAILABLE",
              ...(filters.condition ? { condition: filters.condition } : {}),
              ...(priceRange ? { price: priceRange } : {}),
            },
          },
        }
      : {}),
  };

  const listingWhere = {
    status: { in: ["ACTIVE", "PARTIALLY_SOLD"] },
    ...textConditions,
    ...(filters.condition ? { condition: filters.condition } : {}),
    ...guards.blockingWhere,
    ...guards.countryFilter,
    ...(priceRange ? { price: priceRange } : {}),
  };

  return { auctionWhere, claimsaleWhere, listingWhere };
}

export function sortSupplyResults(results: SearchResult[], sort: string): void {
  switch (sort) {
    case "price_asc":
      results.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      break;
    case "price_desc":
      results.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
      break;
    case "ending_soon":
      results.sort((a, b) => {
        const aEnd = a.endTime ? new Date(a.endTime).getTime() : Infinity;
        const bEnd = b.endTime ? new Date(b.endTime).getTime() : Infinity;
        return aEnd - bEnd;
      });
      break;
    case "most_bids":
      results.sort((a, b) => (b.bidCount ?? 0) - (a.bidCount ?? 0));
      break;
    case "newest":
    default:
      results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      break;
  }
}

export async function searchSupply(
  q: string,
  filters: SupplyFilters,
  guards: SupplyGuards,
  opts: { page?: number; pageSize?: number; take?: number } = {}
): Promise<Paged<SearchResult> & { capped: boolean }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 24;
  const take = opts.take ?? SUPPLY_MERGE_CAP;

  const { auctionWhere, claimsaleWhere, listingWhere } = buildSupplyWheres(
    q,
    filters,
    guards
  );

  const searchAuctions = !filters.type || filters.type === "auction";
  const searchClaimsales = !filters.type || filters.type === "claimsale";
  const searchListings = !filters.type || filters.type === "listing";

  const [auctions, claimsales, listings, auctionCount, claimsaleCount, listingCount] =
    await Promise.all([
      searchAuctions
        ? prisma.auction.findMany({
            where: auctionWhere,
            include: {
              seller: { select: { displayName: true } },
              _count: { select: { bids: true } },
            },
            // Fase 31 search-boost: tier-key SECONDARY achter createdAt.
            orderBy: [
              { createdAt: "desc" as const },
              { seller: { tierRank: "desc" as const } },
            ],
            take,
          })
        : Promise.resolve([]),
      searchClaimsales
        ? prisma.claimsale.findMany({
            where: claimsaleWhere,
            include: {
              seller: { select: { displayName: true } },
              _count: { select: { items: true } },
              items: {
                where: { status: "AVAILABLE" },
                select: { id: true, price: true },
              },
            },
            orderBy: [
              { publishedAt: "desc" as const },
              { seller: { tierRank: "desc" as const } },
            ],
            take,
          })
        : Promise.resolve([]),
      searchListings
        ? prisma.listing.findMany({
            where: listingWhere,
            include: { seller: { select: { displayName: true } } },
            orderBy: [
              { createdAt: "desc" as const },
              { seller: { tierRank: "desc" as const } },
            ],
            take,
          })
        : Promise.resolve([]),
      searchAuctions ? prisma.auction.count({ where: auctionWhere }) : Promise.resolve(0),
      searchClaimsales
        ? prisma.claimsale.count({ where: claimsaleWhere })
        : Promise.resolve(0),
      searchListings ? prisma.listing.count({ where: listingWhere }) : Promise.resolve(0),
    ]);

  const results: SearchResult[] = [];

  for (const a of auctions) {
    results.push({
      id: a.id,
      type: "auction",
      title: a.title,
      price: a.currentBid ?? a.startingBid,
      sellerName: a.seller.displayName,
      createdAt: a.createdAt.toISOString(),
      endTime: a.endTime.toISOString(),
      bidCount: a._count.bids,
      auctionType: a.auctionType,
      currentBid: a.currentBid,
      startingBid: a.startingBid,
      buyNowPrice: a.buyNowPrice,
      imageUrls: a.imageUrls,
    });
  }

  for (const c of claimsales) {
    const prices = c.items.map((i) => i.price);
    results.push({
      id: c.id,
      type: "claimsale",
      title: c.title,
      price: prices.length > 0 ? Math.min(...prices) : null,
      sellerName: c.seller.displayName,
      createdAt: c.createdAt.toISOString(),
      itemCount: c.items.length,
      totalItems: c._count.items,
      priceRange:
        prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : null,
      shippingCost: c.shippingCost,
    });
  }

  for (const l of listings) {
    results.push({
      id: l.id,
      type: "listing",
      title: l.title,
      price: l.price,
      sellerName: l.seller.displayName,
      createdAt: l.createdAt.toISOString(),
      cardName: l.cardName ?? undefined,
      condition: l.condition ?? undefined,
      pricingType: l.pricingType,
      shippingCost: l.shippingCost,
      imageUrls: l.imageUrls,
    });
  }

  sortSupplyResults(results, filters.sort ?? "newest");

  const total = auctionCount + claimsaleCount + listingCount;
  const capped = total > results.length;
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));

  return {
    items: results.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    totalPages,
    capped,
  };
}

export async function countSupply(
  q: string,
  guards: SupplyGuards
): Promise<number> {
  const { auctionWhere, claimsaleWhere, listingWhere } = buildSupplyWheres(q, {}, guards);
  const [a, c, l] = await Promise.all([
    prisma.auction.count({ where: auctionWhere }),
    prisma.claimsale.count({ where: claimsaleWhere }),
    prisma.listing.count({ where: listingWhere }),
  ]);
  return a + c + l;
}

// ---------------------------------------------------------------------------
// Gebruikers
// ---------------------------------------------------------------------------

function buildUserWhere(q: string, guards: SupplyGuards) {
  const query = q.trim();
  const now = new Date();
  return {
    OR: [
      { displayName: { contains: query } },
      { shopSlug: { contains: query.toLowerCase() } },
    ],
    // Geschorste accounts horen niet in publieke zoekresultaten. PERMANENT
    // kan zonder suspendedUntil bestaan → beide velden apart checken.
    AND: [
      { OR: [{ suspensionType: null }, { suspensionType: { not: "PERMANENT" } }] },
      { OR: [{ suspendedUntil: null }, { suspendedUntil: { lt: now } }] },
    ],
    ...(guards.blockedIds.size > 0
      ? { id: { notIn: Array.from(guards.blockedIds) } }
      : {}),
  };
}

const USER_PUBLIC_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
  city: true,
  country: true,
  accountKind: true,
  isVerified: true,
  createdAt: true,
} as const;

function toUserHit(u: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  accountKind: string;
  isVerified: boolean;
  createdAt: Date;
}): UserHit {
  return {
    id: u.id,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    city: u.city,
    country: u.country,
    accountKind: u.accountKind,
    isVerified: u.isVerified,
    createdAt: u.createdAt.toISOString(),
    href: `/verkoper/${u.id}`,
  };
}

export async function searchUsers(
  q: string,
  guards: SupplyGuards,
  opts: { page?: number; pageSize?: number } = {}
): Promise<Paged<UserHit>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 24;
  const where = buildUserWhere(q, guards);

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_PUBLIC_SELECT,
      orderBy: [{ isVerified: "desc" as const }, { displayName: "asc" as const }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: users.map(toUserHit),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function countUsers(q: string, guards: SupplyGuards): Promise<number> {
  return prisma.user.count({ where: buildUserWhere(q, guards) });
}

// ---------------------------------------------------------------------------
// Tellers voor de tab-badges
// ---------------------------------------------------------------------------

export interface SearchCounts {
  cards: number;
  pokemon: number;
  supply: number;
  users: number;
}

export async function countAll(q: string, guards: SupplyGuards): Promise<SearchCounts> {
  const [cards, pokemonHits, supply, users] = await Promise.all([
    countCards(q),
    filterPokemon(q),
    countSupply(q, guards),
    countUsers(q, guards),
  ]);
  return { cards, pokemon: pokemonHits?.length ?? 0, supply, users };
}

// ---------------------------------------------------------------------------
// Header-suggesties (compact, één round-trip)
// ---------------------------------------------------------------------------

export interface SuggestCard {
  id: string;
  name: string;
  localId: string;
  setName: string;
  imageUrl: string | null;
  price: number | null;
  href: string;
}

export interface SuggestPokemon {
  dexId: number;
  displayName: string;
  spriteUrl: string;
  href: string;
}

export interface SuggestSupply {
  id: string;
  type: "auction" | "claimsale" | "listing";
  title: string;
  price: number | null;
  imageUrl: string | null;
  href: string;
}

export interface SuggestUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  href: string;
}

export interface SearchSuggestions {
  query: string;
  cards: SuggestCard[];
  pokemon: SuggestPokemon[];
  supply: SuggestSupply[];
  users: SuggestUser[];
}

const SUGGEST_LIMITS = { cards: 4, pokemon: 3, supply: 3, users: 3 } as const;

export async function getSearchSuggestions(q: string): Promise<SearchSuggestions> {
  const query = q.trim();
  if (query.length < 2) {
    return { query, cards: [], pokemon: [], supply: [], users: [] };
  }

  const guards = await getSupplyGuards();
  const { auctionWhere, claimsaleWhere, listingWhere } = buildSupplyWheres(
    query,
    {},
    guards
  );

  const [cardRows, pokemonHits, auctions, claimsales, listings, users] =
    await Promise.all([
      prisma.card.findMany({
        where: buildCardSearchWhere(query),
        include: {
          cardSet: { select: { name: true, tcgdexSetId: true, releaseDate: true } },
        },
        take: 30,
      }),
      filterPokemon(query),
      prisma.auction.findMany({
        where: auctionWhere,
        select: {
          id: true,
          title: true,
          currentBid: true,
          startingBid: true,
          imageUrls: true,
        },
        orderBy: { createdAt: "desc" as const },
        take: SUGGEST_LIMITS.supply,
      }),
      prisma.claimsale.findMany({
        where: claimsaleWhere,
        select: {
          id: true,
          title: true,
          coverImage: true,
          items: {
            where: { status: "AVAILABLE" },
            select: { price: true },
            take: 25,
          },
        },
        orderBy: { publishedAt: "desc" as const },
        take: SUGGEST_LIMITS.supply,
      }),
      prisma.listing.findMany({
        where: listingWhere,
        select: { id: true, title: true, price: true, imageUrls: true },
        orderBy: { createdAt: "desc" as const },
        take: SUGGEST_LIMITS.supply,
      }),
      prisma.user.findMany({
        where: buildUserWhere(query, guards),
        select: { id: true, displayName: true, avatarUrl: true, isVerified: true },
        orderBy: [{ isVerified: "desc" as const }, { displayName: "asc" as const }],
        take: SUGGEST_LIMITS.users,
      }),
    ]);

  const cards: SuggestCard[] = scoreAndSortCards(cardRows, query)
    .filter((c) => c.cardSet.tcgdexSetId)
    .slice(0, SUGGEST_LIMITS.cards)
    .map((c) => {
      const hit = toCardHit(c);
      return {
        id: hit.id,
        name: hit.name,
        localId: hit.localId,
        setName: hit.setName,
        imageUrl: hit.imageUrl,
        price: hit.price,
        href: hit.href,
      };
    });

  const supply: SuggestSupply[] = [
    ...auctions.map((a) => ({
      id: a.id,
      type: "auction" as const,
      title: a.title,
      price: a.currentBid ?? a.startingBid,
      imageUrl: a.imageUrls ? (parseImageUrls(a.imageUrls)[0] ?? null) : null,
      href: `/veilingen/${a.id}`,
    })),
    ...listings.map((l) => ({
      id: l.id,
      type: "listing" as const,
      title: l.title,
      price: l.price,
      imageUrl: l.imageUrls ? (parseImageUrls(l.imageUrls)[0] ?? null) : null,
      href: `/marktplaats/${l.id}`,
    })),
    ...claimsales.map((c) => ({
      id: c.id,
      type: "claimsale" as const,
      title: c.title,
      price: c.items.length > 0 ? Math.min(...c.items.map((i) => i.price)) : null,
      imageUrl: c.coverImage,
      href: `/claimsales/${c.id}`,
    })),
  ].slice(0, SUGGEST_LIMITS.supply);

  return {
    query,
    cards,
    pokemon: (pokemonHits ?? []).slice(0, SUGGEST_LIMITS.pokemon).map((p) => ({
      dexId: p.dexId,
      displayName: p.displayName,
      spriteUrl: p.spriteUrl,
      href: p.href,
    })),
    supply,
    users: users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      isVerified: u.isVerified,
      href: `/verkoper/${u.id}`,
    })),
  };
}
