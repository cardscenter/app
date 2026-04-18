import { prisma } from "@/lib/prisma";
import { getCard } from "./client";
import { getMergedPricing } from "./pricing";
import { mergeGameplayDetails } from "./gameplay";
import { resolveSpriteUrl } from "./sprite";
import { resolvePriceCharting } from "./pricecharting";

/**
 * Writes EVERYTHING we know about a card to the DB in one pass — gameplay
 * blob, sprite URL, pricing (both normal + reverse-holo), metadata fields.
 * After this runs once per card, the detail page is a pure DB read.
 *
 * Triggered by:
 *   - First-ever view (when `gameplayJson IS NULL`) — blocking inline
 *   - Daily cron (sync-card-prices) — refreshes pricing + legal for active cards
 *
 * Safe to call repeatedly: all upstream fetches cache 24h+ and the DB write
 * is idempotent.
 */
export async function enrichCard(
  cardId: string,
  options: { maxAgeHours?: number } = {}
) {
  const maxAgeHours = options.maxAgeHours ?? 24;

  const existing = await prisma.card.findUnique({ where: { id: cardId } });
  if (!existing) return null;

  // "Never enriched" state → populate EVERYTHING.
  // "Enriched but stale price" state → only refresh pricing (immutable
  // gameplay fields don't change).
  const pricingStale =
    !existing.priceUpdatedAt ||
    Date.now() - existing.priceUpdatedAt.getTime() > maxAgeHours * 60 * 60 * 1000;
  const gameplayMissing = !existing.gameplayJson;

  if (!pricingStale && !gameplayMissing) return existing;

  // Kick off TCGdex card fetch + pricing in parallel (both go through the
  // same 24h fetch cache).
  const [tcgCardRaw, pricing] = await Promise.all([
    gameplayMissing ? getCard(cardId) : Promise.resolve(null),
    getMergedPricing(cardId),
  ]);

  // Gameplay merge + sprite resolution only when we need to refresh the blob.
  let gameplayJson = existing.gameplayJson;
  let spriteUrl = existing.spriteUrl;
  if (gameplayMissing && tcgCardRaw) {
    const merged = await mergeGameplayDetails(tcgCardRaw, cardId);
    if (merged) {
      const blob = {
        category: merged.category,
        attacks: merged.attacks ?? null,
        abilities: merged.abilities ?? null,
        weaknesses: merged.weaknesses ?? null,
        resistances: merged.resistances ?? null,
        retreat: merged.retreat ?? null,
        stage: merged.stage ?? null,
        evolveFrom: merged.evolveFrom ?? null,
        dexId: merged.dexId ?? null,
        regulationMark: merged.regulationMark ?? null,
        legal: merged.legal ?? null,
        trainerType: merged.trainerType ?? null,
        energyType: merged.energyType ?? null,
        effect: merged.effect ?? null,
      };
      gameplayJson = JSON.stringify(blob);

      // Sprite URL resolves once — never changes for a given card
      spriteUrl = await resolveSpriteUrl({
        cardName: merged.name,
        stage: merged.stage,
        dexIdFallback: merged.dexId?.[0],
        category: merged.category,
      });
    }
  }

  // Snapshot today's prices for the history chart (idempotent per day)
  if (pricing && (pricing.avg !== null || pricing["avg-holo"] !== null)) {
    await snapshotPrice(cardId, pricing.avg ?? null, pricing["avg-holo"] ?? null);
  }

  // Fallback image from PriceCharting for cards TCGdex doesn't have a picture for
  // (e.g. very recent SVP promos). Runs whenever we have no image, regardless
  // of whether we fetched tcgCardRaw this run.
  let fallbackImageUrl = existing.imageUrlFull;
  const needsImage = !existing.imageUrl && !existing.imageUrlFull && !tcgCardRaw?.image;
  if (needsImage) {
    const name = tcgCardRaw?.name ?? existing.name;
    const localId = tcgCardRaw?.localId ?? existing.localId;
    if (name && localId) {
      try {
        const pc = await resolvePriceCharting(name, localId);
        if (pc?.imageUrl) fallbackImageUrl = pc.imageUrl;
      } catch {
        // Silent failure — image fallback is best-effort
      }
    }
  }

  // Pull simple metadata from the raw TCGdex card for the cached columns.
  const rarity = tcgCardRaw?.rarity && tcgCardRaw.rarity !== "None" ? tcgCardRaw.rarity : existing.rarity;
  const hp = tcgCardRaw?.hp ?? existing.hp;
  const types = tcgCardRaw?.types ? JSON.stringify(tcgCardRaw.types) : existing.types;
  const illustrator = tcgCardRaw?.illustrator && tcgCardRaw.illustrator !== "None"
    ? tcgCardRaw.illustrator : existing.illustrator;
  const variants = tcgCardRaw?.variants ? JSON.stringify(tcgCardRaw.variants) : existing.variants;

  // Apply manual price override if set (used for edge cases like Pokemon
  // Center stamped promos where CardMarket data groups multiple variants).
  const overrideAvg = existing.priceOverrideAvg;
  const overrideReverseAvg = existing.priceOverrideReverseAvg;
  const useOverrideNormal = overrideAvg != null;
  const useOverrideReverse = overrideReverseAvg != null;

  return prisma.card.update({
    where: { id: cardId },
    data: {
      rarity, hp, types, illustrator, variants,
      gameplayJson,
      spriteUrl,
      imageUrlFull: fallbackImageUrl ?? existing.imageUrlFull,
      priceAvg: useOverrideNormal ? overrideAvg : (pricing?.avg ?? null),
      priceLow: useOverrideNormal ? overrideAvg : (pricing?.low ?? null),
      priceTrend: useOverrideNormal ? overrideAvg : (pricing?.trend ?? null),
      priceAvg7: useOverrideNormal ? overrideAvg : (pricing?.avg7 ?? null),
      priceAvg30: useOverrideNormal ? overrideAvg : (pricing?.avg30 ?? null),
      priceReverseAvg: useOverrideReverse ? overrideReverseAvg : (pricing?.["avg-holo"] ?? null),
      priceReverseLow: useOverrideReverse ? overrideReverseAvg : (pricing?.["low-holo"] ?? null),
      priceReverseTrend: useOverrideReverse ? overrideReverseAvg : (pricing?.["trend-holo"] ?? null),
      priceReverseAvg7: useOverrideReverse ? overrideReverseAvg : (pricing?.["avg7-holo"] ?? null),
      priceReverseAvg30: useOverrideReverse ? overrideReverseAvg : (pricing?.["avg30-holo"] ?? null),
      priceUpdatedAt: pricing ? new Date(pricing.updated) : new Date(),
    },
  });
}

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Upsert today's price snapshot. Safe to call repeatedly. */
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
