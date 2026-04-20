// Map PokeWallet card response → DB Card pricing fields.

import type { PokewalletCard, PokewalletCmPrice, PokewalletTpPrice } from "./types";

export interface MappedPricing {
  // CardMarket EUR (variant_type=normal)
  priceAvg: number | null;
  priceLow: number | null;
  priceTrend: number | null;
  priceAvg7: number | null;
  priceAvg30: number | null;
  // CardMarket EUR reverse-holo (variant_type=holo)
  priceReverseAvg: number | null;
  priceReverseLow: number | null;
  priceReverseTrend: number | null;
  priceReverseAvg7: number | null;
  priceReverseAvg30: number | null;
  priceUpdatedAt: Date;
  // TCGPlayer per variant
  priceTcgplayerNormalLow: number | null;
  priceTcgplayerNormalMid: number | null;
  priceTcgplayerNormalMarket: number | null;
  priceTcgplayerHolofoilLow: number | null;
  priceTcgplayerHolofoilMid: number | null;
  priceTcgplayerHolofoilMarket: number | null;
  priceTcgplayerReverseLow: number | null;
  priceTcgplayerReverseMid: number | null;
  priceTcgplayerReverseMarket: number | null;
  priceTcgplayerUpdatedAt: Date | null;
}

function pickCm(card: PokewalletCard, type: "normal" | "holo"): PokewalletCmPrice | null {
  return card.cardmarket?.prices?.find((p) => p.variant_type === type) ?? null;
}

function pickTp(card: PokewalletCard, sub: string): PokewalletTpPrice | null {
  return card.tcgplayer?.prices?.find((p) => p.sub_type_name === sub) ?? null;
}

/**
 * Map a PokeWallet card to our DB pricing fields.
 *
 * IMPORTANT: PokeWallet's `variant_type === "holo"` means REVERSE HOLO,
 * NOT the holofoil rare-rarity. For Illustration Rare / Special Illustration
 * Rare / Ultra Rare cards, the holo variant typically returns `avg: null,
 * trend: 0` — that's correct (these rarities don't have RH printings).
 */
export function mapPokewalletPricing(card: PokewalletCard): MappedPricing {
  const cmNorm = pickCm(card, "normal");
  const cmHolo = pickCm(card, "holo");
  const tpNormal = pickTp(card, "Normal");
  const tpHolo = pickTp(card, "Holofoil");
  const tpReverse = pickTp(card, "Reverse Holofoil");

  const cmTimestamps = [cmNorm?.updated_at, cmHolo?.updated_at].filter(Boolean) as string[];
  const tpTimestamps = [tpNormal?.updated_at, tpHolo?.updated_at, tpReverse?.updated_at].filter(
    Boolean,
  ) as string[];

  const cmUpdated = cmTimestamps[0] ? new Date(cmTimestamps[0]) : new Date();
  const tpUpdated = tpTimestamps[0] ? new Date(tpTimestamps[0]) : null;

  return {
    priceAvg: cmNorm?.avg ?? null,
    priceLow: cmNorm?.low ?? null,
    priceTrend: cmNorm?.trend ?? null,
    priceAvg7: cmNorm?.avg7 ?? null,
    priceAvg30: cmNorm?.avg30 ?? null,
    priceReverseAvg: cmHolo?.avg ?? null,
    priceReverseLow: cmHolo?.low ?? null,
    priceReverseTrend: cmHolo?.trend ?? null,
    priceReverseAvg7: cmHolo?.avg7 ?? null,
    priceReverseAvg30: cmHolo?.avg30 ?? null,
    priceUpdatedAt: cmUpdated,
    priceTcgplayerNormalLow: tpNormal?.low_price ?? null,
    priceTcgplayerNormalMid: tpNormal?.mid_price ?? null,
    priceTcgplayerNormalMarket: tpNormal?.market_price ?? null,
    priceTcgplayerHolofoilLow: tpHolo?.low_price ?? null,
    priceTcgplayerHolofoilMid: tpHolo?.mid_price ?? null,
    priceTcgplayerHolofoilMarket: tpHolo?.market_price ?? null,
    priceTcgplayerReverseLow: tpReverse?.low_price ?? null,
    priceTcgplayerReverseMid: tpReverse?.mid_price ?? null,
    priceTcgplayerReverseMarket: tpReverse?.market_price ?? null,
    priceTcgplayerUpdatedAt: tpUpdated,
  };
}

/** Strip "/086" suffix and leading zeros from a card number. */
export function normalizeCardNumber(s: string | null | undefined): string {
  if (!s) return "";
  return (s.split("/")[0] ?? "").replace(/^0+/, "") || "0";
}

/** Detect if a PokeWallet card is a special-printing variant (Master/Poke Ball etc). */
export function isVariantPattern(name: string): boolean {
  return /\((Master Ball|Poke Ball|Pok[eé] Ball|Rainbow|Mini Tin)[^)]*Pattern[^)]*\)/i.test(name);
}

/** Extract the pattern label from a variant name, e.g.
 *  "Klink (Master Ball Pattern)" → "Master Ball Pattern".
 *  Returns null if no pattern parenthetical present.
 */
export function extractPatternLabel(name: string): string | null {
  const m = name.match(/\(([^)]*Pattern[^)]*)\)/i);
  if (!m) return null;
  // Normaliseer "Poke Ball" naar "Poké Ball" voor weergave
  return m[1].replace(/Poke Ball/gi, "Poké Ball");
}

/** Pattern variant pricing — uses ONLY TCGPlayer Holofoil (CardMarket data is
 *  a copy of the base card and doesn't reflect the pattern's true market). */
export interface PatternVariantPricing {
  label: string;
  tcgUsd: number | null;
  tcgUpdatedAt: string | null;
}

export function mapPatternVariantPricing(card: PokewalletCard): PatternVariantPricing | null {
  const label = extractPatternLabel(card.card_info.name);
  if (!label) return null;
  const tpHolo = pickTp(card, "Holofoil");
  return {
    label,
    tcgUsd: tpHolo?.market_price ?? null,
    tcgUpdatedAt: tpHolo?.updated_at ?? null,
  };
}

/** Detect if a PokeWallet card is a sealed product (mini-tin, ETB, booster). */
export function isSealedProduct(name: string, cardNumber: string | null | undefined): boolean {
  if (!cardNumber) return true;
  return /Mini Tin|\bETB\b|Booster Box|Booster Bundle|Elite Trainer|\[.*Mini Tin.*\]/i.test(name);
}
