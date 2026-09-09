import { z } from "zod";
import {
  MAX_SHOP_BLOCKS,
  MAX_SOCIAL_LINKS,
  SHOP_FEATURED_MAX,
  SHOP_GALLERY_CAPTION_MAX,
  SHOP_GALLERY_MAX,
  SHOP_HEADING_MAX,
  SHOP_LINKS_TEXT_MAX,
  SHOP_TAGLINE_MAX,
  SHOP_TEXT_MAX,
  type ShopBlock,
} from "@/lib/shop-config";

const uploadUrl = z.string().regex(/^\/api\/uploads\/[\w.-]+$/, "Ongeldige afbeelding");
const blockId = z.string().min(1).max(40);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Ongeldige URL")
  .optional();

const textBlock = z.object({
  id: blockId,
  type: z.literal("TEXT"),
  heading: optionalText(SHOP_HEADING_MAX),
  html: z.string().max(SHOP_TEXT_MAX, `Maximaal ${SHOP_TEXT_MAX} tekens`),
});

const galleryBlock = z.object({
  id: blockId,
  type: z.literal("GALLERY"),
  images: z.array(uploadUrl).min(1, "Voeg minstens één foto toe").max(SHOP_GALLERY_MAX),
  caption: optionalText(SHOP_GALLERY_CAPTION_MAX),
});

const featuredBlock = z.object({
  id: blockId,
  type: z.literal("FEATURED"),
  heading: optionalText(SHOP_HEADING_MAX),
  items: z
    .array(
      z.object({
        type: z.enum(["listing", "auction", "claimsale"]),
        id: z.string().min(1).max(40),
      }),
    )
    .min(1, "Kies minstens één item")
    .max(SHOP_FEATURED_MAX),
});

const linksBlock = z.object({
  id: blockId,
  type: z.literal("LINKS"),
  website: optionalUrl,
  socialLinks: z
    .array(z.string().trim().max(300).regex(/^https?:\/\/\S+$/i, "Ongeldige URL"))
    .max(MAX_SOCIAL_LINKS, `Maximaal ${MAX_SOCIAL_LINKS} socials`),
  contact: optionalText(SHOP_LINKS_TEXT_MAX),
  standLocation: optionalText(SHOP_LINKS_TEXT_MAX),
  openingHours: optionalText(SHOP_LINKS_TEXT_MAX),
});

export const shopBlockSchema = z.discriminatedUnion("type", [textBlock, galleryBlock, featuredBlock, linksBlock]);

export const shopPageSchema = z.object({
  bannerUrl: uploadUrl.nullable(),
  tagline: z.string().trim().max(SHOP_TAGLINE_MAX, `Maximaal ${SHOP_TAGLINE_MAX} tekens`).nullable(),
  published: z.boolean(),
  blocks: z.array(shopBlockSchema).max(MAX_SHOP_BLOCKS, `Maximaal ${MAX_SHOP_BLOCKS} blokken`),
});
export type ShopPageInput = z.infer<typeof shopPageSchema>;

export const convertToBusinessSchema = z.object({
  companyName: z.string().trim().min(2, "Vul een bedrijfsnaam in").max(100),
  cocNumber: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z.-]{6,14}$/, "Ongeldig KvK-/registratienummer"),
  vatNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{2}[A-Z0-9]{2,12}$/.test(v), "Ongeldig btw-id (bv. NL123456789B01)")
    .optional(),
});

/**
 * Tolerante parser voor de render-kant: ongeldige JSON of blokken die niet
 * meer aan het schema voldoen worden stil overgeslagen i.p.v. de pagina te
 * breken.
 */
export function parseShopBlocks(raw: string | null | undefined): ShopBlock[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: ShopBlock[] = [];
    for (const item of arr) {
      const parsed = shopBlockSchema.safeParse(item);
      if (parsed.success) out.push(parsed.data as ShopBlock);
    }
    return out.slice(0, MAX_SHOP_BLOCKS);
  } catch {
    return [];
  }
}
