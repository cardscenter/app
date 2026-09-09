/**
 * Winkelpagina-config (Fase 45) — client-importable, geen server-imports.
 *
 * De winkelpagina (/winkel/<slug>) is het "aangepaste verkopersprofiel" voor
 * tiers met `features.customProfile` (Unlimited / Enterprise / Admin). De
 * eigenaar bouwt 'm op uit blokken die als JSON in `User.shopBlocks` staan;
 * schema/validatie in src/lib/validations/shop.ts, renderer in
 * src/components/shop/shop-blocks.tsx, editor op /dashboard/winkel.
 */
import { MAX_SOCIAL_LINKS } from "@/lib/events/socials";

export { MAX_SOCIAL_LINKS };

export const SHOP_BLOCK_TYPES = ["TEXT", "GALLERY", "FEATURED", "LINKS"] as const;
export type ShopBlockType = (typeof SHOP_BLOCK_TYPES)[number];

export const MAX_SHOP_BLOCKS = 12;
export const SHOP_TEXT_MAX = 4000;
export const SHOP_HEADING_MAX = 80;
export const SHOP_TAGLINE_MAX = 120;
export const SHOP_GALLERY_MAX = 6;
export const SHOP_GALLERY_CAPTION_MAX = 200;
export const SHOP_FEATURED_MAX = 8;
export const SHOP_LINKS_TEXT_MAX = 300;

/** Bloktypen die alleen een bedrijfspagina (User.accountKind === "BUSINESS") mag gebruiken. */
export const SHOP_BUSINESS_ONLY_BLOCKS: ReadonlySet<ShopBlockType> = new Set<ShopBlockType>(["GALLERY"]);

export const SHOP_BLOCK_LABELS_NL: Record<ShopBlockType, { label: string; description: string }> = {
  TEXT: { label: "Tekst", description: "Kop met opgemaakte tekst — bijvoorbeeld 'Over ons' of 'Verzending & retour'." },
  GALLERY: { label: "Fotogalerij", description: "Tot 6 foto's met bijschrift, bijvoorbeeld van je winkel of standplaats." },
  FEATURED: { label: "Uitgelicht aanbod", description: "Kies zelf welke advertenties, veilingen of claimsales je in de kijker zet." },
  LINKS: { label: "Links & contact", description: "Website, socials en contactinformatie." },
};

export type ShopFeaturedItemType = "listing" | "auction" | "claimsale";

export type ShopBlock =
  | { id: string; type: "TEXT"; heading?: string; html: string }
  | { id: string; type: "GALLERY"; images: string[]; caption?: string }
  | {
      id: string;
      type: "FEATURED";
      heading?: string;
      items: { type: ShopFeaturedItemType; id: string }[];
    }
  | {
      id: string;
      type: "LINKS";
      website?: string;
      socialLinks: string[];
      contact?: string;
      /** Alleen bedrijfspagina. */
      standLocation?: string;
      /** Alleen bedrijfspagina. */
      openingHours?: string;
    };

const UPLOAD_URL_RE = /^\/api\/uploads\/[\w.-]+$/;

/** Alleen onze eigen upload-route-URL's mogen als afbeelding in een blok. */
export function isUploadUrl(url: string): boolean {
  return UPLOAD_URL_RE.test(url);
}

export function newShopBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
