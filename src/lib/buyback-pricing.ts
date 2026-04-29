// ── Constants ────────────────────────────────────────────────────────────────

import { getMarktprijs, getMarktprijsReverseHolo } from "@/lib/display-price";

export const BUYBACK_RATE = 0.85;             // 85% van Marktprijs
export const STORE_CREDIT_BONUS = 0.05;       // 5% extra bij tegoed-uitbetaling
export const MINIMUM_COLLECTION_VALUE = 5.0;  // EUR
export const MINIMUM_BULK_VALUE = 30.0;       // EUR

// Cap per kaart: dure kaarten hebben minder marge én binden te veel kapitaal
// in voorraad. Cards met Marktprijs boven deze drempel worden niet ingekocht.
export const MAX_BUYBACK_MARKTPRIJS = 75.0;

// Oude sets hebben onbetrouwbare pricing (pokewallet product-mapping faalt
// vaker, lage sales-volume, vaak PSA-vervuiling). We kopen alleen in vanaf
// XY — eerste release xy1 "XY Base Set" op 2014-02-05.
export const BUYBACK_ERA_START = "2014-02-05";

export type BuybackIneligibleReason = "no_price" | "price_too_high" | "too_old" | "bulk_only";

export interface BuybackEligibilityResult {
  eligible: boolean;
  reason?: BuybackIneligibleReason;
}

/**
 * Rariteiten die alleen via de Bulk Calculator verkocht kunnen worden (niet
 * via de Collectie Calculator). Commons, uncommons en gewone rares — inclusief
 * hun reverse-holo varianten — worden tegen vaste bulk-prijzen afgehandeld.
 * Modernere rare-subtypes (Holo Rare V / VMAX / VSTAR / LV.X etc.) gaan WEL
 * door de Collectie Calculator, dus exact-match i.p.v. prefix.
 */
const BULK_ONLY_RARITIES = new Set([
  "common",
  "uncommon",
  "rare",
  "rare holo",
  "holo rare",
]);

export function isBulkOnlyRarity(rarity: string | null | undefined): boolean {
  if (!rarity) return false;
  return BULK_ONLY_RARITIES.has(rarity.toLowerCase().trim());
}

/**
 * Check of een kaart/variant in aanmerking komt voor inkoop via de Collectie
 * Calculator.
 * - `bulk_only`: rarity valt onder de Bulk Calculator (common/uncommon/rare/
 *   rare holo) — gecheckt BEFORE price/age checks zodat de user altijd een
 *   duidelijke "ga naar Bulk" boodschap krijgt.
 * - `no_price`: geen Marktprijs beschikbaar
 * - `price_too_high`: Marktprijs > MAX_BUYBACK_MARKTPRIJS
 * - `too_old`: set released vóór XY (BUYBACK_ERA_START)
 */
export function checkBuybackEligibility(
  marktprijs: number | null,
  releaseDate: string | null | undefined,
  rarity?: string | null,
): BuybackEligibilityResult {
  if (isBulkOnlyRarity(rarity)) return { eligible: false, reason: "bulk_only" };
  if (marktprijs == null || marktprijs <= 0) return { eligible: false, reason: "no_price" };
  if (marktprijs > MAX_BUYBACK_MARKTPRIJS) return { eligible: false, reason: "price_too_high" };
  if (releaseDate && releaseDate < BUYBACK_ERA_START) return { eligible: false, reason: "too_old" };
  return { eligible: true };
}

// ── Bulk pricing (fixed per-unit prices) ─────────────────────────────────────
//
// `group` splits the UI into two visible sections and drives the card-count
// semantics: only `pokemon` items count toward "totaal kaarten"; `other` items
// (code cards, coins, sleeves, sealed energy) contribute to payout but not to
// the card count.
//
// `tier` drives the tile-styling — commons get a muted gray, Master Ball gets
// a royal purple, etc. Kept separate from `price` so UI colour-coding evolves
// independently from pricing.

export type BulkGroup = "pokemon" | "other";
export type BulkTier = "common" | "uncommon" | "rare" | "holo" | "ultra" | "pokeball" | "masterball" | "oversized" | "code" | "coin" | "sleeves" | "energy";

// Per-unit gewicht in gram — gebruikt voor shipping-advies. Standaard Pokémon
// kaart = 1.8 g; overige items hebben eigen gewichten zoals opgegeven.
export const BULK_PRICING = {
  COMMON:              { price: 0.01, labelKey: "commonUncommon",   group: "pokemon", tier: "common",     weightGrams: 1.8  },
  RARE:                { price: 0.04, labelKey: "rare",              group: "pokemon", tier: "rare",       weightGrams: 1.8  },
  HOLO:                { price: 0.04, labelKey: "holo",              group: "pokemon", tier: "holo",       weightGrams: 1.8  },
  REVERSE_HOLO:        { price: 0.06, labelKey: "reverseHolo",       group: "pokemon", tier: "holo",       weightGrams: 1.8  },
  ULTRA_RARE:          { price: 0.45, labelKey: "ultraRare",         group: "pokemon", tier: "ultra",      weightGrams: 1.8  },
  POKEBALL_REVERSE:    { price: 0.25, labelKey: "pokeballReverse",   group: "pokemon", tier: "pokeball",   weightGrams: 1.8  },
  MASTER_BALL_REVERSE: { price: 2.50, labelKey: "masterBallReverse", group: "pokemon", tier: "masterball", weightGrams: 1.8  },
  OVERSIZED_CARD:      { price: 0.40, labelKey: "oversizedCard",     group: "other",   tier: "oversized",  weightGrams: 15   },
  CODE_CARD:           { price: 0.01, labelKey: "codeCard",          group: "other",   tier: "code",       weightGrams: 1.8  },
  COIN:                { price: 0.05, labelKey: "coin",              group: "other",   tier: "coin",       weightGrams: 5    },
  SLEEVES:             { price: 1.00, labelKey: "sleeves",           group: "other",   tier: "sleeves",    weightGrams: 40   },
  ENERGY:              { price: 0.15, labelKey: "energy",            group: "other",   tier: "energy",     weightGrams: 90   },
} as const satisfies Record<string, { price: number; labelKey: string; group: BulkGroup; tier: BulkTier; weightGrams: number }>;

// Shipping package limit: carriers (PostNL etc.) cap most parcels at 23 kg;
// we reserve 1 kg margin for box + filler so only 22 kg telt als bruikbaar.
export const MAX_SHIPPING_WEIGHT_KG = 22;

export type BulkCategoryKey = keyof typeof BULK_PRICING;

// ── Foil detection ───────────────────────────────────────────────────────────

const FOIL_RARITY_RE =
  /\b(holo|hyper|ultra|full art|illustration|special|double|amazing|radiant|shiny|secret|rainbow)\b/i;

export function isInherentlyFoil(rarity: string | null): boolean {
  return FOIL_RARITY_RE.test(rarity ?? "");
}

// ── Buyback price fields ─────────────────────────────────────────────────────

// Inherits all velden die getMarktprijs / getMarktprijsReverseHolo nodig hebben.
export interface BuybackPriceFields {
  rarity: string | null;
  // CardMarket normal
  priceAvg: number | null;
  priceLow?: number | null;
  priceTrend?: number | null;
  priceAvg7?: number | null;
  priceAvg30?: number | null;
  // CardMarket reverse holo
  priceReverseAvg: number | null;
  priceReverseLow?: number | null;
  priceReverseTrend?: number | null;
  priceReverseAvg7?: number | null;
  priceReverseAvg30?: number | null;
  // TCGPlayer cross-check + RH-fallback
  priceTcgplayerNormalMarket?: number | null;
  priceTcgplayerHolofoilMarket?: number | null;
  priceTcgplayerReverseMarket?: number | null;
  priceTcgplayerReverseMid?: number | null;
  // Manual overrides — always win in getMarktprijs / getMarktprijsReverseHolo
  priceOverrideAvg?: number | null;
  priceOverrideReverseAvg?: number | null;
  // TCGdex variants-JSON (e.g. {"normal":true,"reverse":false,"holo":false})
  variants?: string | null;
  // Set release date — needed to decide whether to trust TCGdex variants
  // flags vs. fall back to market signals on brand-new sets.
  releaseDate?: string | null;
}

// Sets released ON/AFTER this date get the "TCGdex variants-flags may be
// wrong" escape hatch: if CM-RH has strong volume we accept it even if
// variants.reverse === false. Known mis-flagged modern sets: sv06 Twilight
// Masquerade (May 2024), sv08.5 Prismatic Evolutions (Jan 2025).
const MODERN_SET_CUTOFF = "2024-01-01";

/**
 * Heeft deze kaart een ECHTE reverse-holo printing?
 *
 * Pokewallet lekt soms RH-prijzen naar kaarten zonder RH-printing (bv. de
 * hele Detective Pikachu set: Mr. Mime #011 heeft CM avg-holo €5 door een
 * verdwaalde listing, maar er bestaat geen reverse-holo versie). Zonder deze
 * gate krijgen die kaarten een fake RH-variant in de buyback search.
 *
 * We eisen minstens één van deze signalen:
 *   1. TCGdex bevestigt: variants.reverse === true (sterkste signaal)
 *   2. Sterke CardMarket-RH volume: avg-holo ÉN low-holo beide > 0
 *      (low-holo = er staan meerdere listings → echt actief product)
 *   3. TCGPlayer Reverse Holofoil pricing aanwezig
 *
 * Een losse avg-holo zonder low-holo is een zwak signaal (vaak één mis-SKU'd
 * listing) en wordt niet vertrouwd.
 */
export function hasReverseHoloSignal(card: BuybackPriceFields): boolean {
  let variantsObj: { reverse?: boolean; normal?: boolean; holo?: boolean } = {};
  try {
    variantsObj = card.variants ? JSON.parse(card.variants) : {};
  } catch {
    // ignore malformed JSON — fall through to market-data checks
  }

  // 1. Explicit TCGdex confirmation — always trusted
  if (variantsObj.reverse === true) return true;

  // 2. TCGPlayer Reverse Holofoil price — always trusted (independent source)
  const hasTpRh = (card.priceTcgplayerReverseMarket ?? card.priceTcgplayerReverseMid ?? 0) > 0;
  if (hasTpRh) return true;

  // 3. CM-RH strong volume signal — ONLY accepted for modern sets where
  //    TCGdex variants-flags are known to be unreliable. On older promo sets
  //    (Detective Pikachu, Hidden Fates, etc.) pokewallet frequently maps
  //    non-foil cards to a wrong CM product that happens to have RH volume,
  //    which is NOT evidence of a real reverse-holo printing.
  const isModernSet = (card.releaseDate ?? "") >= MODERN_SET_CUTOFF;
  if (isModernSet) {
    const hasStrongCmRh =
      card.priceReverseAvg != null && card.priceReverseAvg > 0 &&
      card.priceReverseLow != null && card.priceReverseLow > 0;
    if (hasStrongCmRh) return true;
  }

  return false;
}

// Variant label: rarity for normal, "Reverse Holo" for reverse
function variantLabel(rarity: string | null, isReverse: boolean): string {
  if (isReverse) return "Reverse Holo";
  return rarity ?? "Normal";
}

export interface VariantPrice {
  /** Marktprijs (RAW, niet de inkoopprijs). Pas `getBuybackPrice()` toe voor inkoop. */
  price: number;
  isReverse: boolean;
  label: string;
}

/**
 * Get available buyback variants for a card.
 * Returns 1 or 2 variants (normal and/or reverse holo) met de RAW Marktprijs.
 *
 * Callers berekenen de inkoopprijs zelf via `getBuybackPrice(variant.price)`.
 * Voor reverse holo gebruikt `getMarktprijsReverseHolo` automatisch een
 * TP-fallback als CardMarket RH-data ontbreekt.
 *
 * Inherently-foil rarities (IR/SIR/UR/etc) tonen alleen hun foil-variant.
 */
export function getAvailableVariants(card: BuybackPriceFields): VariantPrice[] {
  const variants: VariantPrice[] = [];

  // Primary variant (Normal voor gewone kaarten, Holo voor inherently-foil).
  // getMarktprijs valt automatisch terug op TCGPlayer Holofoil als CardMarket
  // data ontbreekt — nodig voor oude Holo Rares zoals Call of Legends Clefable
  // of Battle Styles Octillery die alleen TP-data hebben.
  const primary = getMarktprijs(card);
  if (primary != null && primary > 0) {
    variants.push({
      price: primary,
      isReverse: false,
      label: variantLabel(card.rarity, false),
    });
  }

  // Reverse holo variant — alleen als er een echt RH-signaal is (filtert
  // pokewallet-lekkage op sets zonder RH-printing, bv. Detective Pikachu).
  // Kan ook op inherently-foil kaarten voorkomen (Holo Rare Octillery heeft
  // variants.reverse=true én TP-Reverse pricing).
  if (hasReverseHoloSignal(card)) {
    const rhMarktprijs = getMarktprijsReverseHolo(card);
    if (rhMarktprijs != null && rhMarktprijs > 0) {
      variants.push({ price: rhMarktprijs, isReverse: true, label: variantLabel(card.rarity, true) });
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
 * Calculate buyback price from a market price (BUYBACK_RATE × Marktprijs).
 */
export function getBuybackPrice(marketPrice: number): number {
  return Math.round(marketPrice * BUYBACK_RATE * 100) / 100;
}

/**
 * Calculate store credit bonus amount (STORE_CREDIT_BONUS extra).
 */
export function getStoreCreditBonus(estimatedPayout: number): number {
  return Math.round(estimatedPayout * STORE_CREDIT_BONUS * 100) / 100;
}
