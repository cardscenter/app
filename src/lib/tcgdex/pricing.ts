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

// Approximate USD→EUR rate for TCGPlayer fallback pricing.
// Not perfect, but better than showing no price at all.
const USD_TO_EUR = 0.92;

function mapPtcgToCardmarket(card: PtcgCard): MergedCardmarket | null {
  // Try CardMarket pricing first (EUR, preferred)
  const cm = card.cardmarket;
  if (cm?.prices) {
    const p = cm.prices as Record<string, number | undefined>;
    if (p.averageSellPrice || p.lowPrice || p.trendPrice || p.avg1 || p.avg7 || p.avg30) {
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
  }

  // Fallback: TCGPlayer pricing (USD) — convert to approximate EUR.
  // Some cards (e.g. Celebrations Classic Collection) only have TCGPlayer data.
  const tp = card.tcgplayer as { updatedAt?: string; prices?: Record<string, Record<string, number>> } | undefined;
  if (tp?.prices) {
    // TCGPlayer nests by variant: { holofoil: { low, mid, high, market }, normal: {...}, ... }
    const variant = tp.prices.holofoil ?? tp.prices.normal ?? tp.prices.reverseHolofoil ?? Object.values(tp.prices)[0];
    if (variant) {
      const toEur = (v: number | undefined) => v ? Math.round(v * USD_TO_EUR * 100) / 100 : null;
      return {
        updated: tp.updatedAt ?? new Date().toISOString(),
        unit: "EUR",
        idProduct: 0,
        avg: toEur(variant.market ?? variant.mid),
        low: toEur(variant.low),
        trend: toEur(variant.market),
        avg1: null,
        avg7: toEur(variant.market), // Best approximation we have
        avg30: toEur(variant.mid),
        "avg-holo": null,
        "low-holo": null,
        "trend-holo": null,
        "avg1-holo": null,
        "avg7-holo": null,
        "avg30-holo": null,
        source: "pokemontcg.io",
      };
    }
  }

  return null;
}

/**
 * Returns CardMarket-shaped pricing for a card, trying TCGdex first and
 * falling back to pokemontcg.io via the full resolver cascade.
 */
export async function getMergedPricing(
  tcgdexCardId: string
): Promise<MergedCardmarket | null> {
  const tcg = await getCard(tcgdexCardId);

  // TCGdex mis-maps Trainer Gallery / Galarian Gallery cards to the wrong
  // CardMarket product (same idProduct as the base-set card). For these,
  // always prefer pokemontcg.io which has separate products.
  const localId = tcg?.localId ?? tcgdexCardId.split("-").pop() ?? "";
  const isGalleryCard = /^(TG|GG)\d+$/.test(localId);

  if (!isGalleryCard) {
    const cm = tcg?.pricing?.cardmarket;
    if (cm && (cm.avg !== null || cm.low !== null || cm.trend !== null)) {
      return { ...cm, source: "tcgdex" };
    }
  }

  // Fallback (or primary for gallery cards) via pokemontcg.io.
  const ptcg = await resolvePtcgFromTcgCard(tcg, tcgdexCardId);
  if (!ptcg) {
    console.log(`[pricing] ${tcgdexCardId}: TCGdex=null, ptcg=null`);
    return null;
  }
  const mapped = mapPtcgToCardmarket(ptcg);
  if (!mapped) {
    console.log(`[pricing] ${tcgdexCardId}: ptcg found (${ptcg.id}) but no pricing — cm:${!!ptcg.cardmarket?.prices} tp:${!!(ptcg as Record<string,unknown>).tcgplayer}`);
  }
  return mapped;
}
