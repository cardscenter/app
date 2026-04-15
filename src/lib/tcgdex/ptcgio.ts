// Resolver that finds a pokemontcg.io card from a TCGdex card identity.
//
// pokemontcg.io uses different set IDs for some sets (e.g. TCGdex "sv10.5w" →
// ptcgio "rsv10pt5"). A plain regex can't cover every special case, so we
// try a cascade:
//   1) TCGdex id as-is on ptcgio (lots of sets share the id)
//   2) Transformed id: strip dots + leading zeros in both set and localId
//   3) Query by card-name + set-name + number — the slowest but most robust.

import type { TCGdexCardFull } from "./types";

const PTCG_BASE = "https://api.pokemontcg.io/v2";
const PTCG_TTL = 60 * 60 * 24;

export interface PtcgCard {
  id: string;
  name: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  abilities?: { name: string; text: string; type: string }[];
  attacks?: { name: string; cost?: string[]; damage?: string; text?: string; convertedEnergyCost?: number }[];
  weaknesses?: { type: string; value: string }[];
  resistances?: { type: string; value: string }[];
  retreatCost?: string[];
  convertedRetreatCost?: number;
  rules?: string[];
  regulationMark?: string;
  legalities?: { standard?: string; expanded?: string };
  nationalPokedexNumbers?: number[];
  rarity?: string;
  artist?: string;
  cardmarket?: { url?: string; updatedAt?: string; prices?: Record<string, number> };
  set?: { id: string; name: string };
}

async function fetchById(id: string): Promise<PtcgCard | null> {
  try {
    const res = await fetch(`${PTCG_BASE}/cards/${encodeURIComponent(id)}`, {
      next: { revalidate: PTCG_TTL },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: PtcgCard };
    return data.data ?? null;
  } catch {
    return null;
  }
}

async function search(query: string): Promise<PtcgCard | null> {
  try {
    const res = await fetch(`${PTCG_BASE}/cards?q=${encodeURIComponent(query)}&pageSize=1`, {
      next: { revalidate: PTCG_TTL },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: PtcgCard[] };
    return data.data?.[0] ?? null;
  } catch {
    return null;
  }
}

function transformId(tcgdexCardId: string): string {
  const idx = tcgdexCardId.lastIndexOf("-");
  if (idx < 0) return tcgdexCardId;
  let setPart = tcgdexCardId.slice(0, idx);
  const localPart = tcgdexCardId.slice(idx + 1);
  setPart = setPart.replace(/\./g, "").replace(/([a-zA-Z])0+(\d)/g, "$1$2");
  const cleanLocal = localPart.replace(/^0+(?=\d)/, "");
  return `${setPart}-${cleanLocal}`;
}

/** Escape quotes in a pokemontcg.io query value. */
function q(v: string): string {
  return v.replace(/"/g, '\\"');
}

/**
 * Resolve a pokemontcg.io card for a given TCGdex card.
 * Uses a 3-step cascade; caches every upstream call via fetch-revalidate.
 */
export async function resolvePtcgCard(input: {
  tcgdexId: string;
  name?: string;
  setName?: string;
  localId?: string;
}): Promise<PtcgCard | null> {
  // 1. Same id as-is
  const direct = await fetchById(input.tcgdexId);
  if (direct) return direct;

  // 2. Transformed id
  const transformed = transformId(input.tcgdexId);
  if (transformed !== input.tcgdexId) {
    const viaTransform = await fetchById(transformed);
    if (viaTransform) return viaTransform;
  }

  // 3. Search by name + set.name + number
  if (input.name && input.setName && input.localId) {
    const number = input.localId.replace(/^0+(?=\d)/, "");
    const result = await search(
      `name:"${q(input.name)}" set.name:"${q(input.setName)}" number:${number}`
    );
    if (result) return result;
  }

  return null;
}

/** Convenience: resolve using a TCGdex card object. */
export async function resolvePtcgFromTcgCard(
  tcgCard: TCGdexCardFull | null,
  tcgdexId: string
): Promise<PtcgCard | null> {
  return resolvePtcgCard({
    tcgdexId,
    name: tcgCard?.name,
    setName: tcgCard?.set?.name,
    localId: tcgCard?.localId,
  });
}
