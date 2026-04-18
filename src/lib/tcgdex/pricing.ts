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
import { resolvePriceCharting } from "./pricecharting";
import type { TCGdexPricingCardmarket } from "./types";

export interface MergedCardmarket extends TCGdexPricingCardmarket {
  source: "tcgdex" | "pokemontcg.io" | "pricecharting";
}

// pokemontcg.io uses 0 as a sentinel for "no data" — translate to null so it
// doesn't get mistaken for a real €0 price.
const orNull = (n: number | undefined) =>
  n === undefined || n === null || n === 0 ? null : n;

// Approximate USD→EUR rate for TCGPlayer fallback pricing.
// Not perfect, but better than showing no price at all.
const USD_TO_EUR = 0.92;

// Sanity-check thresholds:
// - VARIANT_MISMATCH_RATIO: CardMarket avg > N × TCGPlayer → likely grouped variants
// - SPIKE_RATIO_AVG30: avg > N × avg30 → recent spike, prefer 30-day average
// - SPIKE_RATIO_LOW: avg > N × low → very wide spread, probably groups variants
const VARIANT_MISMATCH_RATIO = 3;
const SPIKE_RATIO_AVG30 = 2;
const SPIKE_RATIO_LOW = 10;

function tcgPlayerMarketEur(tp: { prices?: Record<string, Record<string, number>> } | undefined): number | null {
  if (!tp?.prices) return null;
  const variant = tp.prices.holofoil ?? tp.prices.normal ?? tp.prices.reverseHolofoil ?? Object.values(tp.prices)[0];
  const usd = variant?.market ?? variant?.mid;
  return usd ? Math.round(usd * USD_TO_EUR * 100) / 100 : null;
}

/**
 * Detect if CardMarket data looks unreliable — either because:
 *   (a) `avg` is way higher than `avg30` (recent single-sale spike)
 *   (b) `avg` is way higher than `low` (huge spread = likely grouped variants)
 * When this returns true, the caller should prefer an alternate source (e.g.
 * pokemontcg.io CardMarket or TCGPlayer).
 */
function looksUnreliable(cm: {
  avg?: number | null;
  avg30?: number | null;
  low?: number | null;
}): boolean {
  const avg = cm.avg ?? 0;
  const avg30 = cm.avg30 ?? 0;
  const low = cm.low ?? 0;
  if (avg <= 0) return false;
  if (avg30 > 0 && avg > avg30 * SPIKE_RATIO_AVG30) return true;
  if (low > 0 && avg > low * SPIKE_RATIO_LOW) return true;
  return false;
}

/** Smooth a CardMarket-like object: if `avg` spikes vs avg30, replace with avg30. */
function smoothPricing<T extends { avg: number | null; avg30?: number | null; low?: number | null }>(cm: T): T {
  if (!looksUnreliable(cm)) return cm;
  // Use the more stable avg30 as the primary avg
  const stableAvg = cm.avg30 ?? cm.avg;
  return { ...cm, avg: stableAvg };
}

function mapPtcgToCardmarket(card: PtcgCard): MergedCardmarket | null {
  const cm = card.cardmarket;
  const tp = card.tcgplayer as { updatedAt?: string; prices?: Record<string, Record<string, number>> } | undefined;
  const cmAvg = cm?.prices?.averageSellPrice as number | undefined;
  const tpMarket = tcgPlayerMarketEur(tp);

  // Sanity check: if CardMarket price is way higher than TCGPlayer, it's
  // likely grouping stamped+normal variants (e.g. Pokemon Center promos).
  // Prefer TCGPlayer which splits them into separate products.
  const useCardMarket =
    cmAvg && cmAvg > 0 &&
    !(tpMarket && tpMarket > 0 && cmAvg > tpMarket * VARIANT_MISMATCH_RATIO);

  // Try CardMarket pricing first (EUR, preferred when sane)
  if (useCardMarket && cm?.prices) {
    const p = cm.prices as Record<string, number | undefined>;
    if (p.averageSellPrice || p.lowPrice || p.trendPrice || p.avg1 || p.avg7 || p.avg30) {
      const result: MergedCardmarket = {
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
      // Apply spike smoothing — if avg is >2× avg30 or >10× low, use avg30
      return smoothPricing(result);
    }
  }

  // Use TCGPlayer (either as primary when CardMarket is unreliable, or as
  // fallback when CardMarket has no data at all).
  if (tp?.prices) {
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
        avg7: toEur(variant.market),
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
    const tp = tcg?.pricing?.tcgplayer as { prices?: Record<string, Record<string, number>> } | null | undefined;

    if (cm && (cm.avg !== null || cm.low !== null || cm.trend !== null)) {
      const tpMarket = tcgPlayerMarketEur(tp ?? undefined);
      const cmAvgNum = cm.avg ?? cm.trend ?? cm.low ?? 0;
      const variantMismatch =
        cmAvgNum > 0 && tpMarket && tpMarket > 0 && cmAvgNum > tpMarket * VARIANT_MISMATCH_RATIO;
      const tcgdexUnreliable = looksUnreliable(cm);

      // Only accept TCGdex directly if it passes both sanity checks
      if (!variantMismatch && !tcgdexUnreliable) {
        return { ...cm, source: "tcgdex" };
      }
      // Otherwise fall through to pokemontcg.io comparison below
    }
  }

  // Fallback (or primary for gallery cards / unreliable TCGdex) via pokemontcg.io.
  const ptcg = await resolvePtcgFromTcgCard(tcg, tcgdexCardId);
  let mapped: MergedCardmarket | null = null;
  if (ptcg) {
    mapped = mapPtcgToCardmarket(ptcg);
  }
  if (mapped) return mapped;

  // Third-tier fallback: PriceCharting for brand-new SVP promos and other cards
  // that TCGdex + pokemontcg.io haven't catalogued yet.
  if (tcg?.name && tcg?.localId) {
    const pc = await resolvePriceCharting(tcg.name, tcg.localId);
    if (pc?.priceEur) {
      return {
        updated: new Date().toISOString(),
        unit: "EUR",
        idProduct: 0,
        avg: pc.priceEur,
        low: pc.priceEur,
        trend: pc.priceEur,
        avg1: null, avg7: pc.priceEur, avg30: pc.priceEur,
        "avg-holo": null, "low-holo": null, "trend-holo": null,
        "avg1-holo": null, "avg7-holo": null, "avg30-holo": null,
        source: "pricecharting",
      };
    }
  }

  // Last resort: use TCGdex's flawed data if we have anything
  const cm = tcg?.pricing?.cardmarket;
  if (cm && cm.avg !== null) {
    return { ...smoothPricing(cm), source: "tcgdex" };
  }

  console.log(`[pricing] ${tcgdexCardId}: no pricing from any source`);
  return null;
}
