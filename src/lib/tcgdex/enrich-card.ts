import { prisma } from "@/lib/prisma";
import { getCard } from "./client";

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

  const cardmarket = tcgCard.pricing?.cardmarket ?? null;

  return prisma.card.update({
    where: { id: cardId },
    data: {
      rarity: tcgCard.rarity ?? existing.rarity,
      hp: tcgCard.hp ?? existing.hp,
      types: tcgCard.types ? JSON.stringify(tcgCard.types) : existing.types,
      illustrator: tcgCard.illustrator ?? existing.illustrator,
      variants: tcgCard.variants ? JSON.stringify(tcgCard.variants) : existing.variants,
      priceAvg: cardmarket?.avg ?? null,
      priceLow: cardmarket?.low ?? null,
      priceTrend: cardmarket?.trend ?? null,
      priceAvg7: cardmarket?.avg7 ?? null,
      priceAvg30: cardmarket?.avg30 ?? null,
      priceUpdatedAt: cardmarket ? new Date(cardmarket.updated) : new Date(),
    },
  });
}
