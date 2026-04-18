// Special reverse-holo variant configuration.
//
// A handful of modern Pokémon sets have themed reverse-holo patterns that
// exist as separate CardMarket/PriceCharting products but aren't exposed as
// variants in the TCGdex or pokemontcg.io APIs (both only surface the
// standard reverse holo). We hand-maintain the set list and fetch prices
// from PriceCharting, which catalogues them reliably.

export type SpecialVariantKey = "poke_ball" | "master_ball" | "ball" | "energy";

export interface SpecialVariantConfig {
  key: SpecialVariantKey;
  // Segment used in the PriceCharting URL, e.g. "master-ball" in
  //   /game/pokemon-prismatic-evolutions/umbreon-master-ball-59
  pcSlug: string;
  // Dutch label for the UI
  labelNl: string;
}

export interface SpecialVariantSetConfig {
  // URL segment PriceCharting uses for this set, e.g. "prismatic-evolutions"
  pcSetSlug: string;
  variants: SpecialVariantConfig[];
}

// Keyed by TCGdex set id (cardSet.tcgdexSetId).
export const SPECIAL_VARIANT_SETS: Record<string, SpecialVariantSetConfig> = {
  // Prismatic Evolutions — Poké Ball + Master Ball patterns on commons/uncommons
  "sv08.5": {
    pcSetSlug: "prismatic-evolutions",
    variants: [
      { key: "poke_ball", pcSlug: "poke-ball", labelNl: "Poké Ball Reverse Holo" },
      { key: "master_ball", pcSlug: "master-ball", labelNl: "Master Ball Reverse Holo" },
    ],
  },
  // Black Bolt — same Poké Ball + Master Ball patterns
  "sv10.5b": {
    pcSetSlug: "black-bolt",
    variants: [
      { key: "poke_ball", pcSlug: "poke-ball", labelNl: "Poké Ball Reverse Holo" },
      { key: "master_ball", pcSlug: "master-ball", labelNl: "Master Ball Reverse Holo" },
    ],
  },
  // White Flare — same Poké Ball + Master Ball patterns
  "sv10.5w": {
    pcSetSlug: "white-flare",
    variants: [
      { key: "poke_ball", pcSlug: "poke-ball", labelNl: "Poké Ball Reverse Holo" },
      { key: "master_ball", pcSlug: "master-ball", labelNl: "Master Ball Reverse Holo" },
    ],
  },
  // Ascended Heroes — Ball + Energy patterns (separate mechanic from PE)
  "me02.5": {
    pcSetSlug: "ascended-heroes",
    variants: [
      { key: "ball", pcSlug: "ball", labelNl: "Ball Reverse Holo" },
      { key: "energy", pcSlug: "energy", labelNl: "Energy Reverse Holo" },
    ],
  },
};

export function getSpecialVariantsForSet(
  tcgdexSetId: string | null | undefined
): SpecialVariantSetConfig | null {
  if (!tcgdexSetId) return null;
  return SPECIAL_VARIANT_SETS[tcgdexSetId] ?? null;
}

export type ExtraVariantsMap = Partial<Record<SpecialVariantKey, number>>;

export function parseExtraVariants(json: string | null | undefined): ExtraVariantsMap {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const out: ExtraVariantsMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && v > 0) out[k as SpecialVariantKey] = v;
    }
    return out;
  } catch {
    return {};
  }
}
