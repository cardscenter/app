// Marktprijs — outlier-bestendige prijsberekening voor Cards Center.
//
// CardMarket's `priceAvg` kan vervuild raken door:
//   • PSA10 / graded verkopen die in dezelfde idProduct landen
//   • Damaged listings die als NM gelabeld worden
//   • idProduct-collisions waar varianten samenvallen (bv. Pawniard BB #142)
//
// Voor onze marktwaarde gebruiken we 4 lagen verdediging:
//   1. excludeHighSpike: drop max rolling-avg als die >1.5× mediaan staat
//   2. Blend van resterende rolling-avgs (priceAvg + priceAvg7 + priceTrend)
//   3. TCGPlayer cross-check: extreme/mild discrepancy → klamp/blend
//   4. Snapshot-anchor: als onze laatste 7 daily snapshots beschikbaar én
//      de blended prijs >2× hun mediaan staat, klamp naar mediaan × 1.5.
//      Vangt kortdurende spikes op die de andere 3 lagen nog niet hebben
//      gefilterd, zonder echte release-week stijgingen volledig te dempen.

export interface DisplayPriceFields {
  priceAvg: number | null;
  priceLow?: number | null;
  priceTrend?: number | null;
  priceAvg7?: number | null;
  priceAvg30?: number | null;
  priceTcgplayerHolofoilMarket?: number | null;
  priceTcgplayerNormalMarket?: number | null;
  rarity?: string | null;
  /**
   * Manual override — when pokewallet's product-mapping is broken AND there
   * is no TCGPlayer cross-check to anchor against, admins set this value
   * via the DB to force a correct Marktprijs. Always wins.
   */
  priceOverrideAvg?: number | null;
  /**
   * Optional: laatste 5-7 daily Marktprijs snapshots (excl. vandaag) uit
   * `CardPriceHistory`. Wanneer aanwezig én >=5 datapunten, wordt de
   * snapshot-mediaan gebruikt als anker tegen kortdurende spikes — als de
   * blended prijs >2× de mediaan ligt, wordt hij geklampt naar 1.5× mediaan
   * (laat 50% groei toe per week, voorkomt 200%+ spikes).
   */
  recentSnapshots?: (number | null)[];
}

// Common/Uncommon krijgen forse EU-bulk-discount, rares NIET. Een Double Rare
// die toevallig €0.75 waard is, is geen bulk-good — TP-discount blijft mild.
const COMMON_TIER_RARITIES = new Set(["common", "uncommon"]);
function isCommonTier(rarity: string | null | undefined): boolean {
  if (!rarity) return false;
  return COMMON_TIER_RARITIES.has(rarity.toLowerCase());
}

const USD_TO_EUR = 0.92;
const OUTLIER_RATIO = 1.5;      // max > median * 1.5 = spike → exclude before blending
const TP_SANITY_RATIO = 1.5;    // estimate > tp * 1.5 = mild discrepancy → blend
const TP_EXTREME_RATIO = 5;     // estimate > tp * 5 = extreme = trust TP
const SNAPSHOT_MIN_POINTS = 5;  // need at least N daily snapshots to use as anchor
const SNAPSHOT_SPIKE_RATIO = 2; // blend > snapshot_median * 2 → clamp
const SNAPSHOT_CLAMP_FACTOR = 1.5; // clamp target = median * 1.5

/**
 * Median of a sparse number-array. Returns null when there isn't enough
 * data to compute a meaningful median.
 */
function medianOf(values: (number | null | undefined)[], minPoints: number): number | null {
  const clean = values.filter((v): v is number => v != null && v > 0);
  if (clean.length < minPoints) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Snapshot-anchor (4th layer). If we have ≥5 daily snapshots of our own
 * Marktprijs and the freshly-blended `prijs` lies >2× their median, the
 * blend is dragged down by today's CM/TP outlier — clamp to median × 1.5.
 *
 * Why median × 1.5 and not the median itself: real release-week hype can
 * legitimately push a card 50% in a week. We want to dampen the spike,
 * not block all upward movement. Spikes that persist for >7 days will
 * gradually pull the snapshot-median up too.
 */
function applySnapshotAnchor(prijs: number, snapshots: (number | null)[] | undefined): number {
  if (!snapshots) return prijs;
  const median = medianOf(snapshots, SNAPSHOT_MIN_POINTS);
  if (median == null) return prijs;
  if (prijs > median * SNAPSHOT_SPIKE_RATIO) return median * SNAPSHOT_CLAMP_FACTOR;
  // No symmetric "crash" clamp (low spikes) — a sudden price drop is more
  // often a real correction than a glitch, and clamping it would hide
  // genuine market movement. We only fight upward outliers.
  return prijs;
}

/**
 * Filter out the single highest rolling-avg if it sits disproportionately above
 * the others. Needed for hype-cards where avg7 (or trend) reflects a recent
 * spike (PSA listings, damaged outliers) while priceAvg still anchors the
 * realistic long-term value. Applied BEFORE averaging so the spike doesn't
 * pull the blend upward.
 *
 * Example: Umbreon ex SIR (Prismatic Evolutions) had [priceAvg €1095,
 * priceTrend €1783, priceAvg7 €2888]. Median €1783 × 1.5 = €2674. avg7
 * exceeds that → dropped. Remaining mean: €1439 (matches TCGPlayer €1357).
 */
function excludeHighSpike(values: number[]): number[] {
  if (values.length < 2) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[sorted.length - 1];
  return max > median * OUTLIER_RATIO ? sorted.slice(0, -1) : sorted;
}

/**
 * EU/US price-tier adjustment factor voor NORMAL Common/Uncommon prints.
 *
 * TCGPlayer (US) heeft hoge minimum-prijzen door shipping/handling overhead:
 * commons gaan zelden onder $0.18. CardMarket EU heeft veel kleine sellers die
 * commons in bulk voor €0.02–0.10 verkopen. Naarmate de waarde stijgt
 * convergeren de markten; voor chase cards (>€20) is EU vaak iets duurder.
 */
function euTierAdjustmentCommon(tpEur: number): number {
  if (tpEur < 1) return 0.3;       // Cheap commons: EU bulk veel goedkoper
  if (tpEur < 5) return 0.7;       // Mid-low: nog steeds EU-discount
  if (tpEur < 20) return 0.95;     // Mid: bijna gelijk
  return 1.1;                       // Chase: kleine EU-premium
}

/**
 * EU/US adjustment voor RARE-tier prints (Rare/Holo/Ultra/Double/IR/SIR/etc.).
 *
 * Empirisch: CardMarket EU zit systematisch 10-20% onder TP USD→EUR voor
 * chase-rarities. Vooral bij kaarten zonder actieve CM-listing (Trainer
 * Gallery, oude promos) is TP's "market price" gebaseerd op lage volumes
 * en daardoor relatief hoog vs. de EU realiteit. Gewenste output: TP $20
 * USD (€18,40 na conversie) → Marktprijs ~€15-16.
 */
function euTierAdjustmentRare(tpEur: number): number {
  if (tpEur < 1) return 0.7;
  if (tpEur < 5) return 0.8;
  if (tpEur < 20) return 0.85;
  return 0.65; // chase cards: aggressive EU-discount — TP market price sits
               // ~35% above CardMarket reality for low-liquidity chase/TG cards.
               // Individuele uitschieters (hype-cards met EU-premium) via
               // priceOverrideAvg op de kaart zelf.
}

function euTierAdjustment(tpEur: number, rarity: string | null | undefined): number {
  return isCommonTier(rarity) ? euTierAdjustmentCommon(tpEur) : euTierAdjustmentRare(tpEur);
}

/**
 * EU/US adjustment voor REVERSE HOLO prints — gebruikt dezelfde curve als
 * rare-tier, want RH-versies circuleren ook niet in bulk-bins.
 * Empirisch bevestigd op Pikachu 151 Common RH: CM €0,38 vs TP $0,52 (€0,48) → 0,79.
 */
const euTierAdjustmentReverseHolo = euTierAdjustmentRare;

/**
 * De prijs die we gebruikers tonen als "Marktprijs".
 * Outlier-bestendig via low-ratio + TCGPlayer cross-check (3 lagen).
 */
export function getMarktprijs(card: DisplayPriceFields): number | null {
  // Manual override wins unconditionally — used when pokewallet mapping is
  // broken and automated outlier-correction can't recover the true price.
  if (card.priceOverrideAvg != null && card.priceOverrideAvg > 0) {
    return Math.round(card.priceOverrideAvg * 100) / 100;
  }

  // Blend the three CardMarket rolling averages so Marktprijs changes daily:
  // priceAvg7 and priceTrend both refresh every day (avg7 shifts as days leave
  // the window, trend reacts to recent weighted sales), while priceAvg anchors
  // the longer-term baseline. This gives small daily movement for ~85% of
  // cards without introducing the volatility of raw avg1 / low / single sales.
  const rollingAvgs = [card.priceAvg, card.priceAvg7, card.priceTrend]
    .filter((v): v is number => v != null && v > 0);
  if (rollingAvgs.length === 0) {
    // No CardMarket data at all (e.g. older Rare Holo cards like Call of
    // Legends Clefable). Fall back to TCGPlayer as the only available source,
    // with EU-tier adjustment so US shipping-overhead prices get normalised.
    const tpUsd = card.priceTcgplayerHolofoilMarket ?? card.priceTcgplayerNormalMarket;
    if (tpUsd != null && tpUsd > 0) {
      const tpEur = tpUsd * USD_TO_EUR;
      return Math.round(tpEur * euTierAdjustment(tpEur, card.rarity) * 100) / 100;
    }
    return null;
  }

  // Drop the high spike (if any) before averaging — stops a volatile avg7
  // (or trend, or avg) from pulling the Marktprijs far above the others.
  const inputs = excludeHighSpike(rollingAvgs);
  let prijs = inputs.reduce((a, b) => a + b, 0) / inputs.length;

  // TCGPlayer cross-check (alleen als TP-data beschikbaar)
  const tpUsd = card.priceTcgplayerHolofoilMarket ?? card.priceTcgplayerNormalMarket;
  if (tpUsd != null && tpUsd > 0) {
    const tpEur = tpUsd * USD_TO_EUR;

    if (prijs > tpEur * TP_EXTREME_RATIO) {
      // EXTREME discrepancy (>5×): pokewallet's CardMarket wijst naar verkeerd
      // product. Vertrouw TP volledig met value+rariteit-bewuste EU adjustment.
      prijs = tpEur * euTierAdjustment(tpEur, card.rarity);
    } else if (tpEur * TP_SANITY_RATIO < prijs) {
      // MILD discrepancy (1.5–5×): pokewallet outlier door PSA-listings of
      // damaged-spike. Blend 50/50 met TP voor stabieler getal.
      prijs = (prijs + tpEur) / 2;
    }
  }

  // 4th layer: snapshot-anchor. Use our own daily Marktprijs history as a
  // sanity check on transient CM/TP spikes the previous layers missed.
  prijs = applySnapshotAnchor(prijs, card.recentSnapshots);

  return Math.round(prijs * 100) / 100;
}

/** Backwards-compat alias — older callers may still reference the old name. */
export const getDisplayPrice = getMarktprijs;

export interface ReverseHoloFields {
  priceReverseAvg: number | null;
  priceReverseLow?: number | null;
  priceReverseTrend?: number | null;
  priceReverseAvg7?: number | null;
  priceReverseAvg30?: number | null;
  priceTcgplayerReverseMarket?: number | null;
  priceTcgplayerReverseMid?: number | null;
  /** Manual reverse-holo override — see DisplayPriceFields.priceOverrideAvg. */
  priceOverrideReverseAvg?: number | null;
  /** See DisplayPriceFields.recentSnapshots — RH equivalent (priceReverse history). */
  recentReverseSnapshots?: (number | null)[];
}

/**
 * Reverse-holo Marktprijs — zelfde 3-laags logica als normal, plus
 * fallback naar TCGPlayer Reverse Holofoil als CardMarket RH-data ontbreekt.
 *
 * Pokewallet's CardMarket-mapping voor RH faalt vaak op cards met idProduct-
 * collisions (151 Bulbasaur/Charmander/Squirtle: CM RH=null, TP Reverse=$0,30).
 * In die gevallen is TCGPlayer onze enige bron — converteer naar EUR + premium.
 */
export function getMarktprijsReverseHolo(card: ReverseHoloFields): number | null {
  // Manual RH override wins unconditionally
  if (card.priceOverrideReverseAvg != null && card.priceOverrideReverseAvg > 0) {
    return Math.round(card.priceOverrideReverseAvg * 100) / 100;
  }

  const tpUsd = card.priceTcgplayerReverseMarket ?? card.priceTcgplayerReverseMid ?? null;
  const tpEur = tpUsd != null && tpUsd > 0 ? tpUsd * USD_TO_EUR : null;

  // Blend CM RH averages (avg + avg7 + trend) for daily movement — same idea
  // as the non-RH version. If ALL three are null/zero, fall back to TP Reverse.
  const rhInputs = [card.priceReverseAvg, card.priceReverseAvg7, card.priceReverseTrend]
    .filter((v): v is number => v != null && v > 0);
  if (rhInputs.length === 0) {
    if (tpEur != null) {
      return Math.round(tpEur * euTierAdjustmentReverseHolo(tpEur) * 100) / 100;
    }
    return null;
  }
  const rhFiltered = excludeHighSpike(rhInputs);
  let prijs = rhFiltered.reduce((a, b) => a + b, 0) / rhFiltered.length;

  // TCGPlayer cross-check (gebruikt RH-tier voor extreme discrepancy)
  if (tpEur != null) {
    if (prijs > tpEur * TP_EXTREME_RATIO) {
      prijs = tpEur * euTierAdjustmentReverseHolo(tpEur);
    } else if (tpEur * TP_SANITY_RATIO < prijs) {
      prijs = (prijs + tpEur) / 2;
    }
  }

  // 4th layer: snapshot-anchor on reverse-holo history.
  prijs = applySnapshotAnchor(prijs, card.recentReverseSnapshots);

  return Math.round(prijs * 100) / 100;
}

/**
 * 7-day delta as a percentage — apples-to-apples version.
 *
 * The naive `(getMarktprijs - priceAvg7) / priceAvg7` is wrong: Marktprijs
 * is the FILTERED value, priceAvg7 is the RAW one. On any card where the
 * filter fires (e.g. corrupted idProduct → TP-blend reduces priceAvg7 €14
 * to Marktprijs €6), you get a fake -54% delta even when the market hasn't
 * moved at all.
 *
 * Correct approach:
 *   • If we have a snapshot from ~7 days ago: use Marktprijs(today) vs
 *     snapshot.priceNormal(7d-old). Both filtered → real movement only.
 *   • Otherwise: use raw priceAvg vs priceAvg7. Both raw → still
 *     apples-to-apples, just less accurate. Returns null when neither
 *     baseline is reliable.
 */
export interface SnapshotPoint {
  date: Date | string;
  price: number | null;
}

export interface DeltaInputs extends DisplayPriceFields {
  /** Snapshot rows of priceNormal, ascending or descending by date. */
  snapshotHistory?: SnapshotPoint[];
}

export interface ReverseDeltaInputs extends ReverseHoloFields {
  /** Snapshot rows of priceReverse, ascending or descending by date. */
  reverseSnapshotHistory?: SnapshotPoint[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_TOLERANCE_DAYS = 2;

/**
 * Find the snapshot price closest to N days ago, within a ±2-day window.
 * Returns null when no snapshot in that window has a usable price.
 *
 * The tolerance window is needed because the daily cron occasionally fails
 * (rate limit, dev-server lock) and skips a day. Without tolerance, every
 * skipped day would suppress that day's delta calculations.
 */
export function findHistoricPrice(
  history: SnapshotPoint[] | undefined,
  daysAgo: number,
): number | null {
  if (!history || history.length === 0) return null;
  const target = Date.now() - daysAgo * DAY_MS;
  const tolerance = SNAPSHOT_TOLERANCE_DAYS * DAY_MS;
  let best: { diff: number; price: number } | null = null;
  for (const row of history) {
    if (row.price == null || row.price <= 0) continue;
    const t = row.date instanceof Date ? row.date.getTime() : new Date(row.date).getTime();
    const diff = Math.abs(t - target);
    if (diff > tolerance) continue;
    if (!best || diff < best.diff) best = { diff, price: row.price };
  }
  return best?.price ?? null;
}

/**
 * 7-day delta percentage on the NORMAL Marktprijs.
 * Snapshot-based when possible; raw-priceAvg fallback otherwise.
 */
export function computeWeeklyDeltaPct(card: DeltaInputs): number | null {
  const current = getMarktprijs(card);
  const snapshot7d = findHistoricPrice(card.snapshotHistory, 7);
  if (current != null && snapshot7d != null) {
    return ((current - snapshot7d) / snapshot7d) * 100;
  }
  // Fallback when we don't have snapshot history yet (new card, sync gap):
  // raw priceAvg vs priceAvg7 stays apples-to-apples since both are raw.
  if (card.priceAvg == null || card.priceAvg <= 0) return null;
  if (card.priceAvg7 == null || card.priceAvg7 <= 0) return null;
  return ((card.priceAvg - card.priceAvg7) / card.priceAvg7) * 100;
}

/** 30-day delta on Marktprijs. Falls back to raw priceAvg vs priceAvg30. */
export function computeMonthlyDeltaPct(card: DeltaInputs): number | null {
  const current = getMarktprijs(card);
  const snapshot30d = findHistoricPrice(card.snapshotHistory, 30);
  if (current != null && snapshot30d != null) {
    return ((current - snapshot30d) / snapshot30d) * 100;
  }
  if (card.priceAvg == null || card.priceAvg <= 0) return null;
  if (card.priceAvg30 == null || card.priceAvg30 <= 0) return null;
  return ((card.priceAvg - card.priceAvg30) / card.priceAvg30) * 100;
}

/** 7-day delta on the REVERSE-HOLO Marktprijs. */
export function computeReverseWeeklyDeltaPct(card: ReverseDeltaInputs): number | null {
  const current = getMarktprijsReverseHolo(card);
  const snapshot7d = findHistoricPrice(card.reverseSnapshotHistory, 7);
  if (current != null && snapshot7d != null) {
    return ((current - snapshot7d) / snapshot7d) * 100;
  }
  if (card.priceReverseAvg == null || card.priceReverseAvg <= 0) return null;
  if (card.priceReverseAvg7 == null || card.priceReverseAvg7 <= 0) return null;
  return ((card.priceReverseAvg - card.priceReverseAvg7) / card.priceReverseAvg7) * 100;
}

/** 30-day delta on reverse-holo Marktprijs. */
export function computeReverseMonthlyDeltaPct(card: ReverseDeltaInputs): number | null {
  const current = getMarktprijsReverseHolo(card);
  const snapshot30d = findHistoricPrice(card.reverseSnapshotHistory, 30);
  if (current != null && snapshot30d != null) {
    return ((current - snapshot30d) / snapshot30d) * 100;
  }
  if (card.priceReverseAvg == null || card.priceReverseAvg <= 0) return null;
  if (card.priceReverseAvg30 == null || card.priceReverseAvg30 <= 0) return null;
  return ((card.priceReverseAvg - card.priceReverseAvg30) / card.priceReverseAvg30) * 100;
}
