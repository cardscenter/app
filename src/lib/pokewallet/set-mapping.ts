// Build & maintain the mapping from our CardSet rows to PokeWallet set_ids.
//
// Strategy: fetch /sets once, then match by:
//   1. Exact name match (case-insensitive)
//   2. Set code match (TCGdex's set code vs PokeWallet set_code)
//   3. Manual mapping in MANUAL_SET_MAPPING for edge cases

import { prisma } from "@/lib/prisma";
import { listAllSets } from "./client";
import type { PokewalletSetSummary } from "./types";

// Manual overrides for sets where automatic matching fails.
// Key = our CardSet.tcgdexSetId, value = PokeWallet set_id.
const MANUAL_SET_MAPPING: Record<string, string> = {
  // Black Bolt + White Flare — verified 2026-04-19, ENGLISH versions
  "sv10.5b": "24325", // SV: Black Bolt (eng)
  "sv10.5w": "24326", // SV: White Flare (eng) — was 24350 (JAP) per ongeluk
  // Mega Evolution era — all English
  "me01": "24380", // ME01: Mega Evolution
  "me02": "24448", // ME02: Phantasmal Flames
  "me02.5": "24541", // ME: Ascended Heroes
  "me03": "24587", // ME03: Perfect Order
  // Sub-sets where pokewallet uses unusual prefixes (SV: instead of SV1:)
  "sv03.5": "23237", // SV: Scarlet & Violet 151 (eng) — was 23599 (JAP)
  "sv04.5": "23353", // SV: Paldean Fates
  "sv08.5": "23821", // SV: Prismatic Evolutions

  // Era-base-sets — pokewallet noemt ze "SM Base Set" / "XY Base Set" /
  // "Diamond and Pearl" terwijl wij "Sun & Moon" / "XY" / "Diamond & Pearl"
  // hebben. Onze normalize-regex matcht ampersand/dash niet.
  "sm1": "1863",  // SM Base Set
  "sm2": "1919",  // SM02: Guardians Rising
  "sm3": "1957",  // SM03: Burning Shadows
  "sm4": "2071",  // SM04: Crimson Invasion
  "sm5": "2178",  // SM05: Ultra Prism
  "sv01": "22873", // SV01: Scarlet & Violet Base Set
  "swsh1": "2585", // SWSH01: Sword & Shield Base Set
  "xy1": "1387",  // XY Base Set
  "dp1": "1430",  // Diamond and Pearl
  "swsh10.5": "3064", // Pokemon GO

  // Promo collections
  "np": "1423",   // Nintendo Promos
  "hgssp": "1453", // HGSS Promos
  "ru1": "1433",  // Pokemon Rumble

  // McDonald's collections — pokewallet noemt ze "McDonald's Promos YYYY"
  "2014xy": "1692",
  "2015xy": "1694",
  "2016xy": "3087",
  "2017sm": "2148",
  "2018sm": "2364",
  "2019sm": "2555",
  "2022swsh": "3150",
  "2023sv": "23306",
  "2024sv": "24163",
  "2021swsh": "2782", // McD 25th Anniversary Promos (was 2021)

  // Era promos
  "swshp": "2545", // SWSH: Sword & Shield Promo Cards
  "xyp": "1451",   // XY Promos
};

/**
 * Gallery sub-sets — cards with alphabetic prefix (TG, GG) live inside their
 * parent set in our DB, but pokewallet tracks them as separate sets. After
 * the main parent-set sync we also pull the gallery sub-set and match by
 * prefix+numeric-suffix.
 *
 * Key = parent CardSet.tcgdexSetId, value = { prefix, pokewalletSetId }.
 */
export interface GallerySubset {
  prefix: string;           // localId prefix, e.g. "TG", "GG"
  pokewalletSetId: string;
}

export const GALLERY_SUBSET_MAPPING: Record<string, GallerySubset> = {
  swsh9:    { prefix: "TG", pokewalletSetId: "3020" },   // Brilliant Stars Trainer Gallery
  swsh10:   { prefix: "TG", pokewalletSetId: "3068" },   // Astral Radiance Trainer Gallery
  swsh11:   { prefix: "TG", pokewalletSetId: "3172" },   // Lost Origin Trainer Gallery
  swsh12:   { prefix: "TG", pokewalletSetId: "17674" },  // Silver Tempest Trainer Gallery
  "swsh12.5": { prefix: "GG", pokewalletSetId: "17689" }, // Crown Zenith: Galarian Gallery
};

interface MappingResult {
  total: number;
  matched: number;
  duplicates: { id: string; name: string; pokewalletId: string }[];
  unmatched: { id: string; name: string; tcgdexSetId: string | null }[];
}

interface CreatedSet {
  id: string;
  name: string;
  pokewalletSetId: string;
}

interface UnmatchedPwSet {
  name: string;
  pokewalletSetId: string;
  releaseDate: string | null;
  reason: string;
}

/**
 * Naam voor de fallback-Series waar net-ontdekte PokeWallet-sets onder
 * komen te hangen. Admin verplaatst ze daarna handmatig via
 * /dashboard/admin/catalog naar de juiste Era.
 */
const FALLBACK_SERIES_NAME = "Onbekend (te categoriseren)";

/**
 * Hoeveel dagen oud een PW-set maximaal mag zijn om als "echt nieuw" te
 * gelden. Sets ouder dan dit zijn vrijwel altijd mapping-mismatches met
 * een set die we al lokaal hebben onder een andere naam — die rapporteren
 * we wel, maar maken we niet automatisch aan.
 */
const NEW_SET_MAX_AGE_DAYS = 90;

/**
 * PokeWallet retourneert release_date als informele string, bv.
 * "12th March, 2014" of "31st March, 2023". Strip ordinal-suffixen en
 * probeer Date.parse. Null bij onparseerbare input.
 */
function parsePwReleaseDate(s: string | null): Date | null {
  if (!s) return null;
  const cleaned = s.replace(/(\d+)(st|nd|rd|th)/i, "$1").trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    // Strip PokeWallet prefix patterns:
    //   "SV1: ", "SWSH9_ ", "SV: ", "ME: ", "SV2a_ Pokemon Card "
    // Digits are OPTIONAL — pokewallet uses "SV:" for sub-sets like Paldean Fates
    .replace(/^[a-z]+\d*[a-z]?[:_]\s*(pokemon\s+card\s+)?/i, "")
    .replace(/^pokemon\s+card\s+/i, "")
    // Drop subtitle suffix like " - Subset" so "XY - Steam Siege" matches "Steam Siege"
    .replace(/^xy\s*-\s*/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export async function refreshSetMapping(
  pwSetsArg?: PokewalletSetSummary[],
): Promise<MappingResult> {
  const pwSets = pwSetsArg ?? (await listAllSets()).data;

  // Clear all existing mappings first so we can prefer sets-with-cards
  // when multiple DB sets match the same PokeWallet set_id.
  await prisma.cardSet.updateMany({
    data: { pokewalletSetId: null, pokewalletSetCode: null },
  });

  // Order: sets WITH cards first, then by name alphabetical.
  // Cards-having sets get first claim on the pokewallet ID.
  const dbSets = await prisma.cardSet.findMany({
    select: {
      id: true,
      name: true,
      tcgdexSetId: true,
      pokewalletSetId: true,
      _count: { select: { cards: true } },
    },
    orderBy: [{ cards: { _count: "desc" } }, { name: "asc" }],
  });

  // Build lookup tables for PokeWallet sets
  const byNorm = new Map<string, PokewalletSetSummary[]>();
  const byCode = new Map<string, PokewalletSetSummary[]>();
  for (const pw of pwSets) {
    const k = normalizeName(pw.name);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k)!.push(pw);
    if (pw.set_code) {
      const c = pw.set_code.toUpperCase();
      if (!byCode.has(c)) byCode.set(c, []);
      byCode.get(c)!.push(pw);
    }
  }

  const unmatched: MappingResult["unmatched"] = [];
  const duplicates: MappingResult["duplicates"] = [];
  const usedPwIds = new Set<string>();
  let matched = 0;

  // Pre-fill with already-mapped sets so we don't re-claim a pokewalletSetId
  for (const db of dbSets) {
    if (db.pokewalletSetId) usedPwIds.add(db.pokewalletSetId);
  }

  for (const db of dbSets) {
    let pwId: string | undefined;

    // 1. Manual override
    if (db.tcgdexSetId && MANUAL_SET_MAPPING[db.tcgdexSetId]) {
      pwId = MANUAL_SET_MAPPING[db.tcgdexSetId];
    }

    // 2. Exact name match (only English when multiple)
    if (!pwId) {
      const candidates = byNorm.get(normalizeName(db.name)) ?? [];
      const eng = candidates.find((c) => c.language === "eng" || c.language === null);
      pwId = eng?.set_id ?? candidates[0]?.set_id;
    }

    // 3. Set-code match (TCGdex set code, may match PokeWallet set_code)
    if (!pwId && db.tcgdexSetId) {
      const candidates = byCode.get(db.tcgdexSetId.toUpperCase()) ?? [];
      const eng = candidates.find((c) => c.language === "eng" || c.language === null);
      pwId = eng?.set_id ?? candidates[0]?.set_id;
    }

    if (!pwId) {
      unmatched.push({ id: db.id, name: db.name, tcgdexSetId: db.tcgdexSetId });
      continue;
    }

    // Skip if another DB-set already has this PokeWallet ID assigned
    if (db.pokewalletSetId !== pwId && usedPwIds.has(pwId)) {
      duplicates.push({ id: db.id, name: db.name, pokewalletId: pwId });
      continue;
    }

    const pw = pwSets.find((p) => p.set_id === pwId);
    try {
      await prisma.cardSet.update({
        where: { id: db.id },
        data: {
          pokewalletSetId: pwId,
          pokewalletSetCode: pw?.set_code ?? null,
        },
      });
      usedPwIds.add(pwId);
      matched++;
    } catch (e) {
      duplicates.push({ id: db.id, name: db.name, pokewalletId: pwId });
    }
  }

  return { total: dbSets.length, matched, duplicates, unmatched };
}

/**
 * Lazy-find-or-create de fallback-Series waar nieuwe sets onder komen.
 * Hangt onder de eerste Category (project is Pokémon-only).
 */
async function getOrCreateFallbackSeries(): Promise<string> {
  const existing = await prisma.series.findFirst({
    where: { name: FALLBACK_SERIES_NAME },
    select: { id: true },
  });
  if (existing) return existing.id;

  const category = await prisma.category.findFirst({ select: { id: true } });
  if (!category) {
    throw new Error(
      "Kan geen Category vinden om fallback-Series onder te hangen — seed eerst de database.",
    );
  }

  const created = await prisma.series.create({
    data: { name: FALLBACK_SERIES_NAME, categoryId: category.id },
    select: { id: true },
  });
  return created.id;
}

/**
 * Detecteer PokeWallet-sets die nog niet aan een DB-CardSet gekoppeld zijn.
 *
 * Auto-create: alleen voor échte nieuwe sets (release_date binnen
 * NEW_SET_MAX_AGE_DAYS). Oudere unmatched PW-sets zijn vrijwel altijd
 * mapping-mismatches met sets die we al hebben onder een andere
 * naam — die rapporteren we apart als `needsReview` zonder aanmaak,
 * zodat admin handmatig kan corrigeren via /dashboard/admin/catalog.
 *
 * Alleen Engelstalige (of language=null) sets worden geconsidereerd —
 * andere talen zijn doorgaans regio-varianten van dezelfde set.
 *
 * Idempotent: tweede call maakt geen duplicaten dankzij @unique-constraint
 * op CardSet.pokewalletSetId + de claimed-filter.
 */
export async function discoverAndCreateNewSets(
  pwSetsArg?: PokewalletSetSummary[],
): Promise<{ created: CreatedSet[]; needsReview: UnmatchedPwSet[] }> {
  const pwSets = pwSetsArg ?? (await listAllSets()).data;

  // Welke pokewalletSetIds zijn al aan een DB-set gekoppeld?
  const mappedRows = await prisma.cardSet.findMany({
    where: { pokewalletSetId: { not: null } },
    select: { pokewalletSetId: true },
  });
  const claimed = new Set<string>();
  for (const row of mappedRows) if (row.pokewalletSetId) claimed.add(row.pokewalletSetId);

  const candidates = pwSets.filter(
    (s) =>
      !claimed.has(s.set_id) &&
      (s.language === "eng" || s.language === null),
  );

  if (candidates.length === 0) return { created: [], needsReview: [] };

  const cutoff = Date.now() - NEW_SET_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const created: CreatedSet[] = [];
  const needsReview: UnmatchedPwSet[] = [];

  // Eerst splitsen: recente sets (auto-create) vs oudere/onbekend (alleen rapporteren)
  const toCreate: PokewalletSetSummary[] = [];
  for (const pw of candidates) {
    const releaseDate = parsePwReleaseDate(pw.release_date);
    if (!releaseDate) {
      needsReview.push({
        name: pw.name,
        pokewalletSetId: pw.set_id,
        releaseDate: pw.release_date,
        reason: "geen parseerbare release_date — waarschijnlijk legacy/promo, niet auto-aangemaakt",
      });
      continue;
    }
    if (releaseDate.getTime() < cutoff) {
      needsReview.push({
        name: pw.name,
        pokewalletSetId: pw.set_id,
        releaseDate: pw.release_date,
        reason: `release_date ouder dan ${NEW_SET_MAX_AGE_DAYS}d — waarschijnlijk mapping-mismatch, niet auto-aangemaakt`,
      });
      continue;
    }
    toCreate.push(pw);
  }

  if (toCreate.length === 0) return { created: [], needsReview };

  const fallbackSeriesId = await getOrCreateFallbackSeries();

  for (const pw of toCreate) {
    try {
      const row = await prisma.cardSet.create({
        data: {
          name: pw.name,
          pokewalletSetId: pw.set_id,
          pokewalletSetCode: pw.set_code,
          releaseDate: pw.release_date,
          cardCount: pw.card_count ?? null,
          seriesId: fallbackSeriesId,
        },
        select: { id: true, name: true, pokewalletSetId: true },
      });
      created.push({ id: row.id, name: row.name, pokewalletSetId: row.pokewalletSetId! });
    } catch (e) {
      // Unique-constraint race (zou niet moeten met de filter, maar safe).
      console.warn(`[discoverNewSets] kon set ${pw.name} niet aanmaken:`, (e as Error).message);
    }
  }

  return { created, needsReview };
}

/**
 * Combineert refreshSetMapping (koppel bestaande DB-sets aan PW) en
 * discoverAndCreateNewSets (maak nieuwe sets aan voor PW-sets die nog
 * niemand heeft). Eén /sets API-call gedeeld over beide stappen.
 *
 * Aanroepen vóór de prijs-sync — anders missen nieuwe sets de eerste run.
 */
export async function syncSetCatalog(): Promise<
  MappingResult & { created: CreatedSet[]; needsReview: UnmatchedPwSet[] }
> {
  const pwSets = (await listAllSets()).data;
  const mapResult = await refreshSetMapping(pwSets);
  const { created, needsReview } = await discoverAndCreateNewSets(pwSets);
  return { ...mapResult, created, needsReview };
}
