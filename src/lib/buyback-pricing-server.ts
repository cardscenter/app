import { prisma } from "@/lib/prisma";
import { isInherentlyFoil, getEffectiveMarketPrice } from "@/lib/buyback-pricing";

const MIN_HISTORY_DAYS = 3;

/**
 * Compute the average price over the last 7 days from our own CardPriceHistory table.
 * Returns null if fewer than MIN_HISTORY_DAYS days of data exist.
 */
export async function computeOwnAvg7(
  cardId: string,
  variant: "normal" | "reverse"
): Promise<number | null> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await prisma.cardPriceHistory.findMany({
    where: {
      cardId,
      date: { gte: sevenDaysAgo },
    },
    select: {
      priceNormal: true,
      priceReverse: true,
    },
    orderBy: { date: "desc" },
  });

  const prices = rows
    .map((r) => (variant === "reverse" ? r.priceReverse : r.priceNormal))
    .filter((p): p is number => p != null && p > 0);

  if (prices.length < MIN_HISTORY_DAYS) return null;

  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Server-side: get the best available market price for a card + variant.
 * Uses the same conservative pricing as the client (min of avg, avg30, capped at 2×low).
 * Priority: own 7d average → CardMarket conservative price.
 */
export async function getServerMarketPrice(
  cardId: string,
  forceReverse?: boolean
): Promise<{
  price: number;
  isReverse: boolean;
} | null> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      rarity: true,
      priceAvg: true,
      priceAvg7: true,
      priceAvg30: true,
      priceLow: true,
      priceReverseAvg: true,
      priceReverseAvg7: true,
      priceReverseAvg30: true,
      priceReverseLow: true,
    },
  });

  if (!card) return null;

  const isReverse = forceReverse ?? isInherentlyFoil(card.rarity);
  const variant = isReverse ? "reverse" : "normal";

  // Try own 7-day average first
  const ownAvg = await computeOwnAvg7(cardId, variant);
  if (ownAvg != null && ownAvg > 0) {
    return { price: ownAvg, isReverse };
  }

  // Fallback to CardMarket prices — uses conservative pricing from shared module
  return getEffectiveMarketPrice(card);
}
