// Abstracts over the two possible image-sources for a Card row:
//   - TCGdex: `imageUrl` is a base URL; full asset = `{base}/{quality}.{ext}`
//   - pokemontcg.io fallback: `imageUrlFull` is a base URL on images.pokemontcg.io
//     (e.g. "https://images.pokemontcg.io/sm35/1"); full asset = append
//     `.png` (low) or `_hires.png` (high).
//
// pokemontcg.io is only used for cards TCGdex doesn't have an image for
// (~5% of the catalog — mostly Trainer Kits, Shining Legends, Dragon Majesty
// and old E-Card sets). Their metadata-API is paid, but the image-CDN stays
// free to hot-link.

export interface CardImageInput {
  imageUrl: string | null;
  imageUrlFull: string | null;
}

/** Returns a full image URL, or null if neither source has an image. */
export function getCardImageUrl(
  card: CardImageInput,
  quality: "low" | "high" = "high"
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
