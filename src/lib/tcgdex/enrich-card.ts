import { prisma } from "@/lib/prisma";
import { getCard } from "./client";
import { getMergedPricing } from "./pricing";

/**
 * Ensures a Card row has full metadata + a recent pricing snapshot.
 * If the row was created by the bulk import (only id/name/imageUrl) or its
 * price snapshot is older than `maxAgeHours`, fetches /v2/en/cards/{id}
 * and persists the rich fields. Returns the updated row.
 *
 * Safe to call on every card-page render: TCGdex's response is cached for
 * 24h by the typed fetch client, so repeated invocations within that window
 * never hit TCGdex. The DB is updated only when actually fetched.
 */
export async function enrichCard(
  cardId: string,
  options: { maxAgeHours?: number } = {}
) {
  const maxAgeHours = options.maxAgeHours ?? 24;

  const existing = await prisma.card.findUnique({
    where: { id: cardId },
  });
  if (!existing) return null;

  const isStale =
    !existing.priceUpdatedAt ||
    Date.now() - existing.priceUpdatedAt.getTime() > maxAgeHours * 60 * 60 * 1000;

  if (!isStale) return existing;

  const tcgCard = await getCard(cardId);
  if (!tcgCard) return existing;

  // Pricing goes through the merged helper: TCGdex first, pokemontcg.io
  // fallback for cards TCGdex doesn't mirror.
  const pricing = await getMergedPricing(cardId);

  // Snapshot today's prices into CardPriceHistory for long-term trend charts.
  // Idempotent per day via the unique (cardId, date) constraint.
  if (pricing && (pricing.avg !== null || pricing["avg-holo"] !== null)) {
    await snapshotPrice(cardId, pricing.avg ?? null, pricing["avg-holo"] ?? null);
  }

  return prisma.card.update({
    where: { id: cardId },
    data: {
      rarity: tcgCard.rarity ?? existing.rarity,
      hp: tcgCard.hp ?? existing.hp,
      types: tcgCard.types ? JSON.stringify(tcgCard.types) : existing.types,
      illustrator: tcgCard.illustrator ?? existing.illustrator,
      variants: tcgCard.variants ? JSON.stringify(tcgCard.variants) : existing.variants,
      priceAvg: pricing?.avg ?? null,
      priceLow: pricing?.low ?? null,
      priceTrend: pricing?.trend ?? null,
      priceAvg7: pricing?.avg7 ?? null,
      priceAvg30: pricing?.avg30 ?? null,
      priceUpdatedAt: pricing ? new Date(pricing.updated) : new Date(),
    },
  });
}

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Upsert today's price snapshot. Safe to call repeatedly — the unique
 * (cardId, date) constraint makes it idempotent within a day. */
export async function snapshotPrice(
  cardId: string,
  priceNormal: number | null,
  priceReverse: number | null
) {
  const date = todayUtcMidnight();
  await prisma.cardPriceHistory.upsert({
    where: { cardId_date: { cardId, date } },
    create: { cardId, date, priceNormal, priceReverse },
    update: { priceNormal, priceReverse },
  });
}
