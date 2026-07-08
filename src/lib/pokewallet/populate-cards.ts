// Card-list population for newly-discovered sets.
//
// The price-sync (sync.ts) only ever UPDATEs existing Card rows — it never
// creates them. So a set discovered by discoverAndCreateNewSets() lands as an
// empty shell (pokewalletSetId set, 0 cards) and stays empty forever unless
// something creates the cards. This module is that missing step.
//
// Source of truth for the card LIST + images + gameplay metadata is TCGdex
// (free, keyless, has images on its CDN + reverse-holo-capable variant flags).
// Pricing is attached afterwards by syncSetByPokewalletId() from PokeWallet.
//
// Reverse-holo note: TCGdex variant flags are often still false on a freshly
// released set. That's fine — hasReverseHoloSignal() (buyback-pricing.ts)
// trusts a strong CardMarket-holo price signal on modern sets, so RH prices
// surface from PokeWallet even when TCGdex says reverse:false.

import { prisma } from "@/lib/prisma";
import { normalizeForSearch } from "@/lib/search-utils";
import { FALLBACK_SERIES_NAME, resolveOrCreateSeriesForTcgdex } from "@/lib/pokewallet/set-mapping";
import {
  fetchTcgdexCard,
  fetchTcgdexSet,
  listTcgdexSets,
  type TcgdexCardFull,
} from "@/lib/tcgdex/client";

/** Max empty sets to populate per sync run — caps the TCGdex burst. */
const MAX_SETS_PER_RUN = 8;
/** Concurrent TCGdex card-detail fetches. */
const FETCH_CONCURRENCY = 8;
/**
 * Only auto-populate shells released in this year or later. Skips ancient
 * legacy promo/jumbo shells (W Promotional 1999, Jumbo 2000, Radiant
 * Collection 2013, …) that TCGdex has no card-list for — otherwise the cron
 * would retry them fruitlessly every day. New-set discovery only creates
 * shells <90 days old, so real new sets always pass this gate.
 */
const MIN_AUTO_POPULATE_YEAR = 2024;

/** Extract a 4-digit year from any releaseDate format ("2026-05-22" or
 *  "22nd May, 2026"). Returns null if no year is present. */
function extractYear(releaseDate: string | null): number | null {
  const m = releaseDate?.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : null;
}

function normalizeSetName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Build the immutable gameplay snapshot stored in Card.gameplayJson. */
function buildGameplayJson(c: TcgdexCardFull): string {
  const blob: Record<string, unknown> = {};
  if (c.category) blob.category = c.category;
  if (c.stage) blob.stage = c.stage;
  if (c.evolveFrom) blob.evolveFrom = c.evolveFrom;
  if (c.attacks?.length) blob.attacks = c.attacks;
  if (c.abilities?.length) blob.abilities = c.abilities;
  if (c.weaknesses?.length) blob.weaknesses = c.weaknesses;
  if (c.resistances?.length) blob.resistances = c.resistances;
  if (typeof c.retreat === "number") blob.retreat = c.retreat;
  if (c.dexId?.length) blob.dexId = c.dexId;
  if (c.regulationMark) blob.regulationMark = c.regulationMark;
  if (c.legal) blob.legal = c.legal;
  if (c.trainerType) blob.trainerType = c.trainerType;
  if (c.energyType) blob.energyType = c.energyType;
  if (c.effect) blob.effect = c.effect;
  if (c.suffix) blob.suffix = c.suffix;
  return JSON.stringify(blob);
}

function coerceHp(hp: unknown): number | null {
  if (typeof hp === "number" && Number.isFinite(hp)) return Math.round(hp);
  if (typeof hp === "string") {
    const n = parseInt(hp, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Run an async mapper over items with a fixed concurrency cap. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Resolve a TCGdex set id for a DB CardSet by matching its name against the
 * TCGdex set catalog. Returns null if no confident match.
 */
export async function resolveTcgdexSetId(cardSetName: string): Promise<string | null> {
  const target = normalizeSetName(cardSetName);
  if (!target) return null;
  const sets = await listTcgdexSets();
  const exact = sets.filter((s) => normalizeSetName(s.name) === target);
  if (exact.length === 1) return exact[0].id;
  // Multiple same-named sets (rare): prefer the one with the most official cards.
  if (exact.length > 1) {
    return exact.sort((a, b) => (b.cardCount?.official ?? 0) - (a.cardCount?.official ?? 0))[0].id;
  }
  return null;
}

export interface PopulateResult {
  cardSetId: string;
  name: string;
  tcgdexSetId: string | null;
  created: number;
  skipped: number;
  error?: string;
}

/**
 * Create Card rows for a CardSet from its TCGdex set. Idempotent: existing
 * cards (matched by TCGdex card id) are skipped. Also backfills set metadata
 * (tcgdexSetId, logo/symbol, ISO releaseDate, official cardCount).
 */
export async function populateSetCards(cardSetId: string): Promise<PopulateResult> {
  const set = await prisma.cardSet.findUnique({
    where: { id: cardSetId },
    select: { id: true, name: true, tcgdexSetId: true, seriesId: true, series: { select: { name: true } } },
  });
  if (!set) return { cardSetId, name: "?", tcgdexSetId: null, created: 0, skipped: 0, error: "CardSet not found" };

  const tcgId = set.tcgdexSetId ?? (await resolveTcgdexSetId(set.name));
  if (!tcgId) {
    return { cardSetId, name: set.name, tcgdexSetId: null, created: 0, skipped: 0, error: "no TCGdex set match by name" };
  }

  const tcgSet = await fetchTcgdexSet(tcgId);
  if (!tcgSet) {
    return { cardSetId, name: set.name, tcgdexSetId: tcgId, created: 0, skipped: 0, error: `TCGdex set ${tcgId} not found` };
  }

  // Hang de set onder de juiste Era zodra we die van TCGdex kennen — maar
  // ALLEEN als 'ie nu nog onder de fallback "Onbekend" hangt, zodat we een
  // handmatige admin-indeling nooit overschrijven.
  if (tcgSet.serie && set.series?.name === FALLBACK_SERIES_NAME) {
    try {
      const seriesId = await resolveOrCreateSeriesForTcgdex(tcgSet.serie);
      if (seriesId && seriesId !== set.seriesId) {
        await prisma.cardSet.update({ where: { id: cardSetId }, data: { seriesId } });
      }
    } catch (e) {
      console.warn(`[populateSetCards] kon set ${set.name} niet herindelen:`, (e as Error).message);
    }
  }

  // Backfill set metadata. tcgdexSetId is @unique — only claim it if free.
  try {
    await prisma.cardSet.update({
      where: { id: cardSetId },
      data: {
        ...(set.tcgdexSetId ? {} : { tcgdexSetId: tcgId }),
        logoUrl: tcgSet.logo ?? undefined,
        symbolUrl: tcgSet.symbol ?? undefined,
        releaseDate: tcgSet.releaseDate ?? undefined,
        cardCount: tcgSet.cardCount?.official ?? tcgSet.cardCount?.total ?? undefined,
      },
    });
  } catch {
    // tcgdexSetId already claimed by another row, or transient lock — retry
    // without the unique field so card creation + the rest still proceed.
    await prisma.cardSet.update({
      where: { id: cardSetId },
      data: {
        logoUrl: tcgSet.logo ?? undefined,
        symbolUrl: tcgSet.symbol ?? undefined,
        releaseDate: tcgSet.releaseDate ?? undefined,
        cardCount: tcgSet.cardCount?.official ?? tcgSet.cardCount?.total ?? undefined,
      },
    });
  }

  const briefs = tcgSet.cards ?? [];
  if (briefs.length === 0) {
    return { cardSetId, name: set.name, tcgdexSetId: tcgId, created: 0, skipped: 0, error: "TCGdex set has no cards" };
  }

  const existing = await prisma.card.findMany({
    where: { cardSetId },
    select: { id: true, imageUrl: true },
  });
  const existingIds = new Set(existing.map((c) => c.id));
  const newBriefs = briefs.filter((b) => !existingIds.has(b.id));

  // Image-refresh voor BESTAANDE kaarten zonder TCGdex-scan: promo-kaarten
  // worden vaak eerder gelist dan gescand, dus een kaart die bij aanmaak geen
  // image had (imageUrl null → viel terug op een low-res bron zoals
  // PriceCharting 240px) krijgt 'm hier alsnog zodra TCGdex de scan uploadt.
  const briefImageById = new Map(briefs.map((b) => [b.id, b.image ?? null]));
  for (const c of existing) {
    if (c.imageUrl) continue;
    const img = briefImageById.get(c.id);
    if (img) {
      await prisma.card.update({ where: { id: c.id }, data: { imageUrl: img } });
    }
  }

  if (newBriefs.length === 0) {
    return { cardSetId, name: set.name, tcgdexSetId: tcgId, created: 0, skipped: briefs.length };
  }

  // Fetch full detail per new card (rarity, variants, gameplay).
  const fulls = await mapPool(newBriefs, FETCH_CONCURRENCY, (b) =>
    fetchTcgdexCard(b.id).catch(() => null),
  );

  const rows = newBriefs.map((b, i) => {
    const full = fulls[i];
    return {
      id: b.id,
      localId: b.localId,
      name: b.name,
      searchName: normalizeForSearch(b.name),
      cardSetId,
      rarity: full?.rarity ?? null,
      hp: coerceHp(full?.hp),
      types: full?.types?.length ? JSON.stringify(full.types) : null,
      illustrator: full?.illustrator ?? null,
      variants: full?.variants ? JSON.stringify(full.variants) : null,
      imageUrl: b.image ?? full?.image ?? null,
      gameplayJson: full ? buildGameplayJson(full) : null,
    };
  });

  let created = 0;
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const r = await prisma.card.createMany({ data: batch });
    created += r.count;
  }

  return { cardSetId, name: set.name, tcgdexSetId: tcgId, created, skipped: briefs.length - newBriefs.length };
}

/**
 * Populate cards for every mapped-but-empty CardSet (pokewalletSetId set,
 * 0 cards). Runs inside the daily catalog sync, right after new-set discovery
 * and before the price-sync — so freshly-discovered sets get their cards and
 * immediately become eligible for pricing in the same run.
 */
export async function populateEmptyMappedSets(): Promise<{ populated: PopulateResult[] }> {
  const allEmpties = await prisma.cardSet.findMany({
    where: { pokewalletSetId: { not: null }, cards: { none: {} } },
    select: { id: true, releaseDate: true },
  });
  // Skip ancient legacy shells TCGdex can't fill; keep undated (likely brand new).
  // Skip ook toekomstige releases (nog niet uitgebracht) — defensief, voor het
  // geval een future-set toch als shell is aangemaakt buiten discover om.
  const empties = allEmpties
    .filter((s) => {
      const y = extractYear(s.releaseDate);
      if (y !== null && y < MIN_AUTO_POPULATE_YEAR) return false;
      const rd = s.releaseDate ? new Date(s.releaseDate.replace(/(\d+)(st|nd|rd|th)/i, "$1").trim()) : null;
      if (rd && !isNaN(rd.getTime()) && rd.getTime() > Date.now()) return false;
      return true;
    })
    .slice(0, MAX_SETS_PER_RUN);

  const populated: PopulateResult[] = [];
  for (const s of empties) {
    try {
      populated.push(await populateSetCards(s.id));
    } catch (e) {
      populated.push({
        cardSetId: s.id, name: "?", tcgdexSetId: null, created: 0, skipped: 0,
        error: (e as Error).message.slice(0, 200),
      });
    }
  }
  return { populated };
}

/** Max groeiende sets die per run een top-up krijgen. */
const MAX_TOPUP_SETS_PER_RUN = 10;

/**
 * Top-up voor GROEIENDE sets: promo-sets (krijgen doorlopend nieuwe kaarten
 * bij elke productrelease) + recente sets. populateEmptyMappedSets pakt alleen
 * lege shells — een set die ooit met 27 kaarten gevuld is maar waar TCGdex er
 * inmiddels 60 kent, groeide vóór deze functie nooit meer mee.
 *
 * Per kandidaat één goedkope TCGdex set-fetch; alleen bij een verschil
 * (nieuwe kaarten óf bestaande kaarten zonder scan die er nu wel is) draait
 * de idempotente populateSetCards, die ook de image-refresh doet.
 */
export async function topUpGrowingSets(): Promise<{ toppedUp: PopulateResult[] }> {
  const sets = await prisma.cardSet.findMany({
    where: { tcgdexSetId: { not: null }, cards: { some: {} } },
    select: {
      id: true, name: true, tcgdexSetId: true, releaseDate: true,
      _count: { select: { cards: true } },
    },
  });
  const nowYear = new Date().getFullYear();
  const candidates = sets.filter((s) => {
    if (/promo/i.test(s.name)) return true;
    const y = extractYear(s.releaseDate);
    return y !== null && y >= nowYear - 1;
  });

  const toppedUp: PopulateResult[] = [];
  for (const s of candidates) {
    if (toppedUp.length >= MAX_TOPUP_SETS_PER_RUN) break;
    try {
      const tcgSet = await fetchTcgdexSet(s.tcgdexSetId!);
      const briefs = tcgSet?.cards ?? [];
      if (briefs.length === 0) continue;
      const hasNewCards = briefs.length > s._count.cards;
      let hasNewImages = false;
      if (!hasNewCards) {
        // Alleen als er geen nieuwe kaarten zijn: check of TCGdex inmiddels
        // scans heeft voor kaarten die bij ons nog imageUrl=null hebben.
        const missingImg = await prisma.card.count({
          where: { cardSetId: s.id, imageUrl: null },
        });
        if (missingImg > 0) {
          hasNewImages = briefs.some((b) => b.image != null);
        }
      }
      if (!hasNewCards && !hasNewImages) continue;
      toppedUp.push(await populateSetCards(s.id));
    } catch (e) {
      toppedUp.push({
        cardSetId: s.id, name: s.name, tcgdexSetId: s.tcgdexSetId, created: 0, skipped: 0,
        error: (e as Error).message.slice(0, 200),
      });
    }
  }
  return { toppedUp };
}
