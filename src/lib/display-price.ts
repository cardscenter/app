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

// The old hasCardMarketDiscrepancy early-return was too blunt: it treated
// a >5× PC-vs-CM gap as "CM is wrong, use PC", but the wrong side is
// ambiguous. Classic false positives: Umbreon ex SIR 161 sits at €1000+
// on CardMarket (correct) while PriceCharting's fuzzy scraper matched
// the regular Umbreon ex at €0.92. Forcing PC would show €0.92 on a
// €1000 card. The median-of-3 below handles both directions robustly —
// it picks the middle value, so one outlier never wins.

/** The price we show to users and use as the "current" in trend math. */
export function getDisplayPrice(card: DisplayPriceFields): number | null {
  const avg = card.priceAvg && card.priceAvg > 0 ? card.priceAvg : null;
  const trend = card.priceTrend && card.priceTrend > 0 ? card.priceTrend : null;
  const pc = card.pricePriceChartingEur && card.pricePriceChartingEur > 0 ? card.pricePriceChartingEur : null;

  if (avg == null) return trend ?? pc ?? null;

  if (avg >= EXPENSIVE_BLEND_THRESHOLD) {
    // Blend all three sources via median. The middle value wins, so a
    // single outlier (wrong CM idProduct, stale trend, or mis-matched
    // PriceCharting fuzzy search) never dominates. With three consistent
    // sources the median matches the true market.
    const sources = [avg, trend, pc].filter((v): v is number => v != null);
    if (sources.length >= 2) return medianOf(sources);
  }

  if (avg >= MIDPRICE_TREND_THRESHOLD && trend != null) {
    return trend;
  }

  return avg;
}

/** 7-day delta as a percentage. Uses the blended display price as the
 * "current" so trend % agrees with what the user sees as the market
 * value. Returns null when either side isn't meaningful. */
export function computeWeeklyDeltaPct(card: DisplayPriceFields): number | null {
  const current = getDisplayPrice(card);
  const baseline = card.priceAvg7;
  if (current == null || baseline == null || baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
}
