// Resolves the "best" current market price for a card and the 7-day
// delta percentage, blending multiple data sources for illiquid high-
// value cards.
//
// Context: CardMarket's daily avg swings 30-50% on a single sale for
// cards with few weekly transactions. For illiquid expensive cards we
// want a smoother signal:
//   - >=€250: median of CardMarket avg + CardMarket trend + PriceCharting
//     ungraded. Median is robust to one outlier in any direction.
//   - >€100: CardMarket's own volatility-smoothed `trend` field, which is
//     explicitly designed as a stable central tendency.
//   - Otherwise: plain CardMarket avg.

export interface DisplayPriceFields {
  priceAvg: number | null;
  priceTrend: number | null;
  pricePriceChartingEur: number | null;
  priceAvg7: number | null;
}

const EXPENSIVE_BLEND_THRESHOLD = 250; // EUR — use median of 3 sources
const MIDPRICE_TREND_THRESHOLD = 100;  // EUR — use CardMarket `trend`

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const DISCREPANCY_RATIO = 5; // >5× gap between CardMarket and PriceCharting

/** True when CardMarket priceAvg and PriceCharting disagree by more than
 * the discrepancy ratio — implies the CardMarket idProduct is mapped to a
 * sealed product or wrong card. Callers should treat priceAvg / priceAvg7
 * / priceAvg30 as unreliable for this card. */
export function hasCardMarketDiscrepancy(card: DisplayPriceFields): boolean {
  const avg = card.priceAvg;
  const pc = card.pricePriceChartingEur;
  if (avg == null || avg <= 0 || pc == null || pc <= 0) return false;
  return avg > pc * DISCREPANCY_RATIO || pc > avg * DISCREPANCY_RATIO;
}

/** The price we show to users and use as the "current" in trend math. */
export function getDisplayPrice(card: DisplayPriceFields): number | null {
  const avg = card.priceAvg && card.priceAvg > 0 ? card.priceAvg : null;
  const trend = card.priceTrend && card.priceTrend > 0 ? card.priceTrend : null;
  const pc = card.pricePriceChartingEur && card.pricePriceChartingEur > 0 ? card.pricePriceChartingEur : null;

  if (avg == null) return trend ?? pc ?? null;

  // CardMarket idProduct sometimes maps an individual card to a sealed
  // product or an unrelated listing (e.g. XY Black Star Promos all reading
  // €5550). When priceAvg and PriceCharting disagree by >5×, CardMarket is
  // almost certainly wrong and PriceCharting gets the truth. This check
  // runs before blending so median-of-3 doesn't get dragged by two
  // correlated-bad values (avg + trend both from the same broken product).
  if (pc != null && (avg > pc * DISCREPANCY_RATIO || pc > avg * DISCREPANCY_RATIO)) {
    return pc;
  }

  if (avg >= EXPENSIVE_BLEND_THRESHOLD) {
    // Blend all three sources. Median absorbs one outlier (a noisy avg, a
    // stale trend, or a regional PriceCharting price).
    const sources = [avg, trend, pc].filter((v): v is number => v != null);
    if (sources.length >= 2) return medianOf(sources);
    // Only avg available — fall back to it
  }

  if (avg >= MIDPRICE_TREND_THRESHOLD && trend != null) {
    return trend;
  }

  return avg;
}

/** 7-day delta as a percentage. Uses the blended display price as the
 * "current" so trend % agrees with what the user sees as the market
 * value. Returns null when either side isn't meaningful — including
 * when CardMarket data is discordant with PriceCharting (the 7-day
 * rolling avg is derived from the same wrong product so it can't be
 * trusted as a baseline). */
export function computeWeeklyDeltaPct(card: DisplayPriceFields): number | null {
  if (hasCardMarketDiscrepancy(card)) return null;
  const current = getDisplayPrice(card);
  const baseline = card.priceAvg7;
  if (current == null || baseline == null || baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
}
