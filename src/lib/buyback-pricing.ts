// ── Constants ────────────────────────────────────────────────────────────────

export const BUYBACK_RATE = 0.85;
export const STORE_CREDIT_BONUS = 0.20; // 20% extra when choosing store credit
export const MINIMUM_COLLECTION_VALUE = 5.0; // EUR
export const MINIMUM_BULK_VALUE = 30.0; // EUR

// ── Bulk pricing (fixed per-unit prices) ─────────────────────────────────────

export const BULK_PRICING = {
  COMMON:              { price: 0.01, labelKey: "common" },
  UNCOMMON:            { price: 0.01, labelKey: "uncommon" },
  RARE:                { price: 0.04, labelKey: "rare" },
  HOLO:                { price: 0.04, labelKey: "holo" },
  REVERSE_HOLO:        { price: 0.06, labelKey: "reverseHolo" },
  ULTRA_RARE:          { price: 0.45, labelKey: "ultraRare" },
  POKEBALL_REVERSE:    { price: 0.25, labelKey: "pokeballReverse" },
  MASTER_BALL_REVERSE: { price: 2.50, labelKey: "masterBallReverse" },
  CODE_CARD:           { price: 0.01, labelKey: "codeCard" },
  COIN:                { price: 0.05, labelKey: "coin" },
  SLEEVES:             { price: 1.00, labelKey: "sleeves" },
  ENERGY:              { price: 0.15, labelKey: "energy" },
} as const;

export type BulkCategoryKey = keyof typeof BULK_PRICING;

// ── Foil detection ───────────────────────────────────────────────────────────

const FOIL_RARITY_RE =
  /\b(holo|hyper|ultra|full art|illustration|special|double|amazing|radiant|shiny|secret|rainbow)\b/i;

export function isInherentlyFoil(rarity: string | null): boolean {
  return FOIL_RARITY_RE.test(rarity ?? "");
}

// ── Buyback price fields (extended for variant selection) ────────────────────

export interface BuybackPriceFields {
  rarity: string | null;
  priceAvg: number | null;
  priceAvg7: number | null;
  priceAvg30: number | null;
  priceLow: number | null;
  priceReverseAvg: number | null;
  priceReverseAvg7: number | null;
  priceReverseAvg30: number | null;
  priceReverseLow: number | null;
  variants?: string | null; // JSON string: {reverse:bool, normal:bool, holo:bool, ...}
}

// Variant label: rarity for normal, "Reverse Holo" for reverse
function variantLabel(rarity: string | null, isReverse: boolean): string {
  if (isReverse) return "Reverse Holo";
  return rarity ?? "Normal";
}

// 90% of avg sell price approximates the lowest NL listings for NM cards.
// CardMarket's averageSellPrice includes all EU countries; NL prices tend
// to sit slightly below the EU average.
export const MARKET_VALUE_RATE = 0.90;

/**
 * Market price for buyback purposes.
 *
 * Takes 90% of `priceAvg` (CardMarket averageSellPrice) to approximate the
 * lowest NL-available NM listings. Falls back to avg30 if avg is unavailable.
 *
 * avg7 is deliberately excluded because a single expensive sale can distort
 * it heavily (e.g. Pikachu Celebrations avg7=€8 vs avg=€4).
 *
 * Final buyback = 85% of this market value = ~76.5% of avg sell price.
 */
function bestAvailablePrice(
  avg: number | null,
  avg30: number | null,
): number | null {
  const base = (avg != null && avg > 0) ? avg : (avg30 != null && avg30 > 0) ? avg30 : null;
  if (base == null) return null;
  return Math.round(base * MARKET_VALUE_RATE * 100) / 100;
}

export interface VariantPrice {
  price: number;
  isReverse: boolean;
  label: string; // "normal" | "reverse"
}

/**
 * Get available buyback variants for a card.
 * Returns 1 or 2 variants (normal and/or reverse holo) with pricing.
 * Cards with inherently-foil rarity only show their foil variant.
 */
export function getAvailableVariants(card: BuybackPriceFields): VariantPrice[] {
  const variants: VariantPrice[] = [];
  const foil = isInherentlyFoil(card.rarity);

  // Normal variant (skip for inherently-foil cards)
  if (!foil) {
    const p = bestAvailablePrice(card.priceAvg, card.priceAvg30);
    if (p != null && p > 0) {
      variants.push({ price: p, isReverse: false, label: variantLabel(card.rarity, false) });
    }
  }

  // Reverse holo variant — rely purely on CardMarket's avg-holo price as the
  // signal that a reverse variant physically exists. We used to also check
  // TCGdex's `variants.reverse` flag, but it's wrong for whole modern sets
  // (e.g. sv06 Twilight Masquerade, sv08.5 Prismatic Evolutions).
  const rp = bestAvailablePrice(card.priceReverseAvg, card.priceReverseAvg30);
  if (rp != null && rp > 0) {
    variants.push({ price: rp, isReverse: true, label: variantLabel(card.rarity, true) });
  }

  // For inherently-foil cards where reverse pricing is empty,
  // fall back to normal pricing fields (some APIs don't split)
  if (foil && variants.length === 0) {
    const p = bestAvailablePrice(card.priceAvg, card.priceAvg30);
    if (p != null && p > 0) {
      variants.push({ price: p, isReverse: false, label: variantLabel(card.rarity, false) });
    }
  }

  return variants;
}

/**
 * Simple single-price getter for backward compatibility.
 * Uses conservative pricing, picking the first available variant.
 */
export function getEffectiveMarketPrice(card: BuybackPriceFields): {
  price: number;
  isReverse: boolean;
} | null {
  const variants = getAvailableVariants(card);
  if (variants.length === 0) return null;
  // Prefer non-reverse for generic single-price
  const normal = variants.find((v) => !v.isReverse);
  return normal ?? variants[0];
}

/**
 * Calculate buyback price from a market price (85%).
 */
export function getBuybackPrice(marketPrice: number): number {
  return Math.round(marketPrice * BUYBACK_RATE * 100) / 100;
}

/**
 * Calculate store credit bonus amount (20% extra).
 */
export function getStoreCreditBonus(estimatedPayout: number): number {
  return Math.round(estimatedPayout * STORE_CREDIT_BONUS * 100) / 100;
}
