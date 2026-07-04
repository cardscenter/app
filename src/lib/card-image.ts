// Builds the full image URL for a Card. Image hosting is via TCGdex's
// public CDN (images.tcgdex.net) — no API calls, just static URL construction.
// Cards seeded long ago may have a `imageUrlFull` from a fallback source
// (images.pokemontcg.io) which we also append the right suffix for.

export interface CardImageInput {
  imageUrl: string | null;
  imageUrlFull: string | null;
}

/** Returns a full image URL, or null if neither source has an image. */
export function getCardImageUrl(
  card: CardImageInput,
  quality: "low" | "high" = "high",
): string | null {
  if (card.imageUrlFull) {
    if (card.imageUrlFull.includes("pokemontcg.io")) {
      return quality === "high"
        ? `${card.imageUrlFull}_hires.png`
        : `${card.imageUrlFull}.png`;
    }
    return card.imageUrlFull;
  }
  if (card.imageUrl) {
    return `${card.imageUrl}/${quality}.webp`;
  }
  return null;
}
