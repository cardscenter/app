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
  "me04": "24655", // ME04: Chaos Rising
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

  // ── SM-era sets (geverifieerd 2026-06-16 op CardMarket-dekking). PokeWallet
  // heeft per set vaak twee records: een POSITIEVE Engelse (set_id 2xxx, soms
  // TCGPlayer-only) en een NEGATIEVE CardMarket-only set. We zijn een EU-markt,
  // dus kiezen we per set de id met de beste CardMarket-EUR-dekking:
  //   • sm6/sm7/xy9: de positieve set heeft volledige CM+RH → gebruik die.
  //   • sm8/sm9/sm10/sm11/sm12: de positieve set is TCGPlayer-only, de
  //     negatieve set heeft volledige CM-EUR + native reverse-holo → gebruik
  //     die. De negatieve-id /search is vervuild, maar sync.ts haalt negatieve
  //     sets nu schoon op via /sets/{id} + /cards/{id} (CardMarket-data).
  "sm7": "2278",   // SM - Celestial Storm (was 23686 = JAP) — positief heeft CM
  "sm6": "2209",   // SM - Forbidden Light (was 23685 = JAP) — positief heeft CM
  "xy9": "1701",   // XY - BREAKpoint (was 2175 stub) — positief heeft CM
  "sm8": "-113",   // Lost Thunder — CardMarket-only set (positief 2328 is TP-only)
  "sm9": "-173",   // Team Up — CardMarket-only set
  "sm10": "-185",  // Unbroken Bonds — CardMarket-only set
  "sm11": "-186",  // Unified Minds — CardMarket-only set
  "sm12": "-16",   // Cosmic Eclipse — CardMarket-only set

  // Oude/promo sets die verkeerd of niet gemapt waren
  "bw1": "1400",     // Black and White (was 23893 = JAP, dekte alleen helft)
  "ex1": "1393",     // Ruby and Sapphire (was unmapped)
  "ecard1": "1375",  // Expedition (was -93, CM-only met minder kaarten)
  "bwp": "1407",     // Black and White Promos (was unmapped)
  "dpp": "1421",     // Diamond and Pearl Promos (was unmapped)
  "2011bw": "1401",  // McDonald's Promos 2011 (was -115)
  "2012bw": "1427",  // McDonald's Promos 2012 (was -116)
  "basep": "-192",   // Wizards Promos (was -193 = slechts 7 kaarten; -192 dekt #1-53)
  // Kleine CardMarket-only (negatieve) sets — geen positieve Engelse variant.
  // De negatieve-id routing in sync.ts haalt ze schoon op via /sets + /cards.
  "bog": "-8",        // Best of Game Promos
  "fut2020": "-95",   // Futsal Promo 2020
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
  // Shiny Vault — SV-prefix cards binnen Shining Fates (PW tracks apart).
  "swsh4.5": { prefix: "SV", pokewalletSetId: "2781" },  // Shining Fates: Shiny Vault
  // Radiant Collection — RC-prefix subsets binnen Generations / Legendary Treasures.
  g1:       { prefix: "RC", pokewalletSetId: "1729" },   // Generations: Radiant Collection
  bw11:     { prefix: "RC", pokewalletSetId: "1465" },   // Legendary Treasures: Radiant Collection
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
export const FALLBACK_SERIES_NAME = "Onbekend (te categoriseren)";

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

  // NON-DESTRUCTIEF: bestaande mappings BEHOUDEN. We voegen alleen
  // nieuwe mappings toe voor DB-sets die er nog geen hebben. Reden:
  // refreshSetMapping kan door Railway's HTTP-timeout halverwege
  // worden gekapt, en als we eerst alles clearen, blijven veel sets
  // ongekoppeld → cron kan niets meer syncen → site stuk.
  //
  // Trade-off: als een DB-set ten onrechte aan de verkeerde PW-set
  // gekoppeld is geraakt, blijft die foutieve mapping tot een admin
  // 'm handmatig overschrijft via /dashboard/admin/catalog.

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
    // Sla over: deze DB-set heeft al een mapping. Non-destructief.
    if (db.pokewalletSetId) {
      matched++;
      continue;
    }

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
 * Zoek (of maak) de juiste Era-Series voor een TCGdex-set aan de hand van
 * z'n `serie: { id, name }`. Zo landen nieuw-ontdekte sets automatisch onder
 * de juiste Era (bv. Chaos Rising → Mega Evolution) i.p.v. permanent onder de
 * fallback "Onbekend".
 *
 * Volgorde:
 *   1. Match op `tcgdexSeriesId === serie.id` (uniek, meest betrouwbaar).
 *   2. Match op genormaliseerde naam; backfill dan de ontbrekende tcgdexSeriesId.
 *   3. Anders: maak een nieuwe Series aan (naam + tcgdexSeriesId) onder de
 *      eerste Category.
 *
 * Retourneert de seriesId, of null als er geen bruikbare serie-info is.
 */
export async function resolveOrCreateSeriesForTcgdex(
  serie: { id?: string | null; name?: string | null } | null | undefined,
): Promise<string | null> {
  const serieId = serie?.id?.trim();
  const serieName = serie?.name?.trim();
  if (!serieId && !serieName) return null;

  // 1. Op tcgdexSeriesId (uniek)
  if (serieId) {
    const byId = await prisma.series.findUnique({
      where: { tcgdexSeriesId: serieId },
      select: { id: true },
    });
    if (byId) return byId.id;
  }

  // 2. Op genormaliseerde naam — backfill tcgdexSeriesId als die ontbreekt.
  if (serieName) {
    const target = normalizeName(serieName);
    const candidates = await prisma.series.findMany({
      select: { id: true, name: true, tcgdexSeriesId: true },
    });
    const match = candidates.find((s) => normalizeName(s.name) === target);
    if (match) {
      if (serieId && !match.tcgdexSeriesId) {
        try {
          await prisma.series.update({
            where: { id: match.id },
            data: { tcgdexSeriesId: serieId },
          });
        } catch {
          // tcgdexSeriesId al geclaimd door een andere rij — laat 'm zoals 'ie is.
        }
      }
      return match.id;
    }
  }

  // 3. Nieuwe Era aanmaken onder de eerste Category.
  const category = await prisma.category.findFirst({ select: { id: true } });
  if (!category) return null;
  try {
    const created = await prisma.series.create({
      data: {
        name: serieName || serieId!,
        tcgdexSeriesId: serieId ?? null,
        categoryId: category.id,
      },
      select: { id: true },
    });
    return created.id;
  } catch {
    // Race op de @unique tcgdexSeriesId — lees 'm terug.
    if (serieId) {
      const raced = await prisma.series.findUnique({
        where: { tcgdexSeriesId: serieId },
        select: { id: true },
      });
      if (raced) return raced.id;
    }
    return null;
  }
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
    // Toekomstige releases (bv. een aangekondigde-maar-nog-niet-uitgebrachte set)
    // NIET aanmaken. Alleen rapporteren zodat admin ziet dat 'ie eraan komt.
    if (releaseDate.getTime() > Date.now()) {
      needsReview.push({
        name: pw.name,
        pokewalletSetId: pw.set_id,
        releaseDate: pw.release_date,
        reason: "release_date in de toekomst — nog niet uitgebracht, niet auto-aangemaakt",
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
