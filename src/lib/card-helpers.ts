// Pure utility helpers for cards — no API calls, just URL construction
// and id manipulation. Card pricing data comes from PokeWallet via
// src/lib/pokewallet/.

import { prisma } from "@/lib/prisma";

/** Lowercase, ASCII-only, dash-separated slug suitable for URL segments. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Build a card slug like "charizard-ex-054" — name-slug + localId. */
export function cardSlug(name: string, localId: string): string {
  return `${slugify(name)}-${localId.toLowerCase()}`;
}

/** Extract the localId from a card slug. Returns null if no trailing "-<localId>". */
export function localIdFromSlug(slug: string): string | null {
  const idx = slug.lastIndexOf("-");
  if (idx < 0) return null;
  return slug.slice(idx + 1);
}

/**
 * Extract the set-id portion of a card id.
 *   "base1-4" → "base1"
 *   "swsh10.5-010" → "swsh10.5"
 */
export function extractSetIdFromCardId(cardId: string): string | null {
  const idx = cardId.lastIndexOf("-");
  if (idx <= 0) return null;
  return cardId.slice(0, idx);
}

/**
 * Given a card id (e.g. "base1-4"), find the matching local CardSet via
 * its `tcgdexSetId` and return its database id. Returns null if not found.
 */
export async function resolveLocalCardSetId(
  cardId: string | null | undefined,
): Promise<string | null> {
  if (!cardId) return null;
  const setId = extractSetIdFromCardId(cardId);
  if (!setId) return null;

  const set = await prisma.cardSet.findUnique({
    where: { tcgdexSetId: setId },
    select: { id: true },
  });
  return set?.id ?? null;
}

import { getMarktprijs } from "@/lib/display-price";

export interface PricingSnapshot {
  /** De Marktprijs — outlier-bestendig (zie getMarktprijs in display-price.ts) */
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg7: number | null;
  avg30: number | null;
  updated: string | null;
}

interface CardPricingFields {
  priceAvg: number | null;
  priceLow: number | null;
  priceTrend: number | null;
  priceAvg7: number | null;
  priceAvg30: number | null;
  priceUpdatedAt: Date | null;
  priceTcgplayerHolofoilMarket: number | null;
  priceTcgplayerNormalMarket: number | null;
  rarity?: string | null;
}

/**
 * Lookup a card's pricing snapshot from DB via card id.
 * The `avg` field is our outlier-resistant Marktprijs (not raw priceAvg).
 */
export async function getCardPricing(
  cardId: string | null | undefined,
): Promise<PricingSnapshot | null> {
  if (!cardId) return null;
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      priceAvg: true,
      priceLow: true,
      priceTrend: true,
      priceAvg7: true,
      priceAvg30: true,
      priceUpdatedAt: true,
      priceTcgplayerHolofoilMarket: true,
      priceTcgplayerNormalMarket: true,
      rarity: true,
    },
  });
  return cardToPricingSnapshot(card);
}

export function cardToPricingSnapshot(
  card: CardPricingFields | null,
): PricingSnapshot | null {
  if (!card || card.priceAvg === null) return null;
  return {
    avg: getMarktprijs(card),
    low: card.priceLow,
    trend: card.priceTrend,
    avg7: card.priceAvg7,
    avg30: card.priceAvg30,
    updated: card.priceUpdatedAt?.toISOString() ?? null,
  };
}
