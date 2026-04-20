import { prisma } from "@/lib/prisma";
import { isInherentlyFoil, getAvailableVariants, hasReverseHoloSignal } from "@/lib/buyback-pricing";
import { getMarktprijs, getMarktprijsReverseHolo } from "@/lib/display-price";

/**
 * Server-side: get the market price for a card + variant.
 * Returns the outlier-resistant Marktprijs (zelfde formule als de detail-page).
 * Buyback-prijs = `BUYBACK_RATE × marktprijs` (zie getBuybackPrice).
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
      variants: true,
      cardSet: { select: { releaseDate: true } },
      // CardMarket normal
      priceAvg: true,
      priceLow: true,
      priceTrend: true,
      priceAvg7: true,
      priceAvg30: true,
      // CardMarket reverse holo
      priceReverseAvg: true,
      priceReverseLow: true,
      priceReverseTrend: true,
      priceReverseAvg7: true,
      priceReverseAvg30: true,
      // TCGPlayer cross-check + RH-fallback
      priceTcgplayerNormalMarket: true,
      priceTcgplayerHolofoilMarket: true,
      priceTcgplayerReverseMarket: true,
      priceTcgplayerReverseMid: true,
      // Manual overrides — always win in Marktprijs
      priceOverrideAvg: true,
      priceOverrideReverseAvg: true,
    },
  });

  if (!card) return null;

  const cardWithReleaseDate = { ...card, releaseDate: card.cardSet?.releaseDate ?? null };
  const isReverse = forceReverse ?? isInherentlyFoil(card.rarity);

  if (isReverse) {
    // Verify the card actually has an RH printing before pricing it — blocks
    // client-side manipulation for cards without a real reverse variant.
    if (!hasReverseHoloSignal(cardWithReleaseDate)) {
      // Inherently-foil cards without RH data fall back to normal Marktprijs
      if (isInherentlyFoil(card.rarity)) {
        const normal = getMarktprijs(card);
        if (normal != null && normal > 0) return { price: normal, isReverse: false };
      }
      return null;
    }
    const rh = getMarktprijsReverseHolo(card);
    if (rh != null && rh > 0) return { price: rh, isReverse: true };
    const normal = getMarktprijs(card);
    if (normal != null && normal > 0) return { price: normal, isReverse: false };
    return null;
  }

  const normal = getMarktprijs(card);
  if (normal != null && normal > 0) return { price: normal, isReverse: false };

  // Geen normal data — probeer beschikbare variant
  const variants = getAvailableVariants(card);
  if (variants.length === 0) return null;
  // getAvailableVariants returnt al een buyback-price (BUYBACK_RATE × marktprijs)
  // Wij willen hier de RAW marktprijs, dus reverse-engineer dat niet — pak gewoon RH.
  const rh = getMarktprijsReverseHolo(card);
  if (rh != null && rh > 0) return { price: rh, isReverse: true };
  return null;
}
