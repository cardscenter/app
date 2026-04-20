// Marktprijs — outlier-bestendige prijsberekening voor Cards Center.
//
// CardMarket's `priceAvg` kan vervuild raken door:
//   • PSA10 / graded verkopen die in dezelfde idProduct landen
//   • Damaged listings die als NM gelabeld worden
//   • idProduct-collisions waar varianten samenvallen (bv. Pawniard BB #142)
//
// Voor onze marktwaarde gebruiken we 2 lagen verdediging:
//   1. Spike-detectie via low: als avg > 3× low → switch naar avg7 (recente
//      stabielere signaal, vaak zonder de outlier-influx)
//   2. TCGPlayer cross-check: als CardMarket-display > 1,5× TCGPlayer-EUR →
//      blend 50/50 (US-markt als sanity-check op extreme EU-spike)

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
}

// Common/Uncommon krijgen forse EU-bulk-discount, rares NIET. Een Double Rare
// die toevallig €0.75 waard is, is geen bulk-good — TP-discount blijft mild.
const COMMON_TIER_RARITIES = new Set(["common", "uncommon"]);
function isCommonTier(rarity: string | null | undefined): boolean {
  if (!rarity) return false;
  return COMMON_TIER_RARITIES.has(rarity.toLowerCase());
}

const USD_TO_EUR = 0.92;
const SPIKE_RATIO = 3;          // avg > low * 3 = outlier-spike
const TP_SANITY_RATIO = 1.5;    // estimate > tp * 1.5 = mild discrepancy → blend
const TP_EXTREME_RATIO = 5;     // estimate > tp * 5 = extreme = trust TP

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
  const inputs = [card.priceAvg, card.priceAvg7, card.priceTrend]
    .filter((v): v is number => v != null && v > 0);
  if (inputs.length === 0) {
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
  let prijs = inputs.reduce((a, b) => a + b, 0) / inputs.length;

  // 1. Spike-detectie via low: if our blended estimate is >3× the lowest
  //    listing, one of the rolling avgs is being pulled up by a PSA10 /
  //    damaged outlier. Fall back to avg7 (the cleanest single signal).
  if (card.priceLow != null && card.priceLow > 0 && card.priceLow * SPIKE_RATIO < prijs) {
    prijs = card.priceAvg7 ?? card.priceTrend ?? card.priceAvg ?? prijs;
  }

  // 2. TCGPlayer cross-check (alleen als TP-data beschikbaar)
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
  let prijs = rhInputs.reduce((a, b) => a + b, 0) / rhInputs.length;

  // Spike-detectie via low
  if (
    card.priceReverseLow != null &&
    card.priceReverseLow > 0 &&
    card.priceReverseLow * SPIKE_RATIO < prijs
  ) {
    prijs = card.priceReverseAvg7 ?? card.priceReverseTrend ?? card.priceReverseAvg ?? prijs;
  }

  // TCGPlayer cross-check (gebruikt RH-tier voor extreme discrepancy)
  if (tpEur != null) {
    if (prijs > tpEur * TP_EXTREME_RATIO) {
      prijs = tpEur * euTierAdjustmentReverseHolo(tpEur);
    } else if (tpEur * TP_SANITY_RATIO < prijs) {
      prijs = (prijs + tpEur) / 2;
    }
  }

  return Math.round(prijs * 100) / 100;
}

/**
 * 7-day delta as a percentage. Uses Marktprijs as "current" so the delta
 * matches what the user sees as the market value.
 */
export function computeWeeklyDeltaPct(card: DisplayPriceFields): number | null {
  const current = getMarktprijs(card);
  const baseline = card.priceAvg7;
  if (current == null || baseline == null || baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
}
