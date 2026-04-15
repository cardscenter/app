// Unified CardMarket pricing lookup.
//
// TCGdex mirrors CardMarket but doesn't cover every card (e.g. many SVP
// promos return `cardmarket: null`). Pokemontcg.io mirrors the same
// CardMarket data, usually covering more cards. We try TCGdex first (richer
// structure, already cached), and fall back to pokemontcg.io when TCGdex
// returns null pricing.
//
// Both are free to hit from the server; we cache at the fetch layer for 24h.

import { getCard } from "./client";
import { resolvePtcgFromTcgCard, type PtcgCard } from "./ptcgio";
import type { TCGdexPricingCardmarket } from "./types";

export interface MergedCardmarket extends TCGdexPricingCardmarket {
  source: "tcgdex" | "pokemontcg.io";
}

// pokemontcg.io uses 0 as a sentinel for "no data" — translate to null so it
// doesn't get mistaken for a real €0 price.
const orNull = (n: number | undefined) =>
  n === undefined || n === null || n === 0 ? null : n;

function mapPtcgToCardmarket(card: PtcgCard): MergedCardmarket | null {
  const cm = card.cardmarket;
  if (!cm?.prices) return null;
  const p = cm.prices as Record<string, number | undefined>;
  if (
    !p.averageSellPrice && !p.lowPrice && !p.trendPrice &&
    !p.avg1 && !p.avg7 && !p.avg30
  ) {
    return null;
  }
  return {
    updated: cm.updatedAt ?? new Date().toISOString(),
    unit: "EUR",
    idProduct: 0,
    avg: orNull(p.averageSellPrice),
    low: orNull(p.lowPrice),
    trend: orNull(p.trendPrice),
    avg1: orNull(p.avg1),
    avg7: orNull(p.avg7),
    avg30: orNull(p.avg30),
    "avg-holo": orNull(p.reverseHoloSell),
    "low-holo": orNull(p.reverseHoloLow),
    "trend-holo": orNull(p.reverseHoloTrend),
    "avg1-holo": orNull(p.reverseHoloAvg1),
    "avg7-holo": orNull(p.reverseHoloAvg7),
    "avg30-holo": orNull(p.reverseHoloAvg30),
    source: "pokemontcg.io",
  };
}

/**
 * Returns CardMarket-shaped pricing for a card, trying TCGdex first and
 * falling back to pokemontcg.io via the full resolver cascade.
 */
export async function getMergedPricing(
  tcgdexCardId: string
): Promise<MergedCardmarket | null> {
  const tcg = await getCard(tcgdexCardId);
  const cm = tcg?.pricing?.cardmarket;
  if (cm && (cm.avg !== null || cm.low !== null || cm.trend !== null)) {
    return { ...cm, source: "tcgdex" };
  }

  // Fallback via pokemontcg.io — uses id-as-is → transformed-id → name+set search.
  const ptcg = await resolvePtcgFromTcgCard(tcg, tcgdexCardId);
  if (!ptcg) return null;
  return mapPtcgToCardmarket(ptcg);
}
