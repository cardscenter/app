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

export async function refreshSetMapping(): Promise<MappingResult> {
  const pwResponse = await listAllSets();
  const pwSets = pwResponse.data;

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
