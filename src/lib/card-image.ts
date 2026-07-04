// Builds the full image URL for a Card. Image hosting is via TCGdex's
// public CDN (images.tcgdex.net) — no API calls, just static URL construction.
// Cards seeded long ago may have a `imageUrlFull` from a fallback source
// (images.pokemontcg.io) which we also append the right suffix for.

export interface CardImageInput {
  imageUrl: string | null;
  imageUrlFull: string | null;
  imageMirrorKey?: string | null;
}

/** Returns a full image URL, or null if neither source has an image. */
export function getCardImageUrl(
  card: CardImageInput,
  quality: "low" | "high" = "high",
): string | null {
  // Weerbaarheids-mirror (PokeWallet → R2) heeft voorrang: eigen opslag,
  // onafhankelijk van TCGdex. Stem bevat geen size/extensie — die bouwen we hier.
  if (card.imageMirrorKey) {
    return `/api/uploads/${card.imageMirrorKey}-${quality}.jpg`;
  }
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

/**
 * Upgradet een low-res kaart-URL naar high-res. Werkt voor beide schema's:
 * TCGdex (`…/low.webp` → `…/high.webp`) én de R2/schijf-mirror
 * (`…-low.jpg` → `…-high.jpg`). Voor call-sites die alleen de low-URL in
 * client-state hebben (bv. buyback-winkelwagen hover-preview).
 */
export function upscaleCardImageUrl(lowUrl: string): string {
  return lowUrl.replace("/low.", "/high.").replace("-low.jpg", "-high.jpg");
}

export interface SetLogoInput {
  logoUrl: string | null;
  logoMirrorKey?: string | null;
}

/**
 * Returns the set-logo URL, or null. Prefers the R2/disk mirror (PokeWallet
 * /sets/:id/image, resilient) over the raw TCGdex CDN logoUrl.
 */
export function getSetLogoUrl(set: SetLogoInput): string | null {
  if (set.logoMirrorKey) {
    return `/api/uploads/${set.logoMirrorKey}.png`;
  }
  return set.logoUrl ?? null;
}
