"use server";

import { requireFeature } from "@/lib/feature-flags-server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasFeature } from "@/lib/subscription-tiers";
import { shopPageSchema } from "@/lib/validations/shop";
import { SHOP_BUSINESS_ONLY_BLOCKS, type ShopBlock } from "@/lib/shop-config";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { parseImageUrls } from "@/lib/upload";

/**
 * Winkelpagina opslaan (Fase 45): banner, slogan, gepubliceerd-vlag en de
 * blokkenlijst in één payload (`formData.payload` = JSON van shopPageSchema).
 *
 * Guards: ingelogd → tier-feature customProfile → Zod → bedrijfs-only blokken
 * en -velden geweigerd voor particulieren → rich-text gesanitized → featured-
 * items op eigenaarschap gecheckt (onbekende/andermans id's stil weg).
 */
export async function updateShopPage(formData: FormData) {
  // Feature-flag-guard (Community Hub, Fase 1): FEATURE_WALLET uit = alleen admins.
  const feat = await requireFeature("FEATURE_WALLET");
  if ("error" in feat) return { error: feat.error };

  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true, accountKind: true, shopSlug: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };
  if (!hasFeature(user.accountType, "customProfile")) {
    return { error: "De winkelpagina is beschikbaar vanaf Unlimited" };
  }

  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: "Ongeldige gegevens" };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "Ongeldige gegevens" };
  }
  const parsed = shopPageSchema.safeParse(json);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige gegevens" };
  }
  const input = parsed.data;
  const isBusiness = user.accountKind === "BUSINESS";

  // Bedrijfs-only blokken/velden weigeren voor particulieren (UI verbergt ze,
  // maar de payload is client-side samengesteld).
  for (const block of input.blocks) {
    if (!isBusiness && SHOP_BUSINESS_ONLY_BLOCKS.has(block.type)) {
      return { error: "Een fotogalerij is alleen beschikbaar op een bedrijfspagina" };
    }
    if (!isBusiness && block.type === "LINKS" && (block.standLocation || block.openingHours)) {
      return { error: "Standplaats en openingstijden zijn alleen beschikbaar op een bedrijfspagina" };
    }
  }

  // Featured-items: alleen eigen, nog-actieve items overhouden.
  const wantedListings = new Set<string>();
  const wantedAuctions = new Set<string>();
  const wantedClaimsales = new Set<string>();
  for (const block of input.blocks) {
    if (block.type !== "FEATURED") continue;
    for (const it of block.items) {
      if (it.type === "listing") wantedListings.add(it.id);
      else if (it.type === "auction") wantedAuctions.add(it.id);
      else wantedClaimsales.add(it.id);
    }
  }
  const [ownListings, ownAuctions, ownClaimsales] = await Promise.all([
    wantedListings.size
      ? prisma.listing.findMany({ where: { id: { in: [...wantedListings] }, sellerId: userId }, select: { id: true } })
      : Promise.resolve([]),
    wantedAuctions.size
      ? prisma.auction.findMany({ where: { id: { in: [...wantedAuctions] }, sellerId: userId }, select: { id: true } })
      : Promise.resolve([]),
    wantedClaimsales.size
      ? prisma.claimsale.findMany({ where: { id: { in: [...wantedClaimsales] }, sellerId: userId }, select: { id: true } })
      : Promise.resolve([]),
  ]);
  const owned = {
    listing: new Set(ownListings.map((x) => x.id)),
    auction: new Set(ownAuctions.map((x) => x.id)),
    claimsale: new Set(ownClaimsales.map((x) => x.id)),
  };

  const blocks: ShopBlock[] = [];
  for (const block of input.blocks) {
    if (block.type === "TEXT") {
      blocks.push({ ...block, heading: block.heading || undefined, html: sanitizeRichText(block.html) });
    } else if (block.type === "FEATURED") {
      const items = block.items.filter((it) => owned[it.type].has(it.id));
      if (items.length === 0) return { error: "Een uitgelicht-blok bevat geen (eigen) items meer" };
      blocks.push({ ...block, heading: block.heading || undefined, items });
    } else if (block.type === "LINKS") {
      blocks.push({
        ...block,
        website: block.website || undefined,
        contact: block.contact || undefined,
        standLocation: isBusiness ? block.standLocation || undefined : undefined,
        openingHours: isBusiness ? block.openingHours || undefined : undefined,
      });
    } else {
      blocks.push({ ...block, caption: block.caption || undefined });
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      shopBannerUrl: input.bannerUrl,
      shopTagline: input.tagline || null,
      shopBlocks: JSON.stringify(blocks),
      shopPublished: input.published,
      shopUpdatedAt: new Date(),
    },
  });

  if (user.shopSlug) revalidatePath(`/winkel/${user.shopSlug}`);
  revalidatePath(`/verkoper/${userId}`);
  revalidatePath("/dashboard/winkel");

  return { success: true };
}

export type FeaturableItem = {
  type: "listing" | "auction" | "claimsale";
  id: string;
  title: string;
  image: string | null;
  price: number | null;
  status: string;
};

/** Eigen actieve/geplande items waaruit de eigenaar een uitgelicht-blok kiest. */
export async function listOwnFeaturableItems(): Promise<{ items: FeaturableItem[] } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const sellerId = session.user.id;

  const [listings, auctions, claimsales] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId, status: { in: ["ACTIVE", "PARTIALLY_SOLD"] } },
      select: { id: true, title: true, imageUrls: true, price: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.auction.findMany({
      where: { sellerId, status: { in: ["ACTIVE", "SCHEDULED"] } },
      select: { id: true, title: true, imageUrls: true, currentBid: true, startingBid: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.claimsale.findMany({
      where: { sellerId, status: { in: ["LIVE", "SCHEDULED"] } },
      select: { id: true, title: true, coverImage: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const items: FeaturableItem[] = [
    ...listings.map((l) => ({
      type: "listing" as const,
      id: l.id,
      title: l.title,
      image: parseImageUrls(l.imageUrls)[0] ?? null,
      price: l.price,
      status: l.status,
    })),
    ...auctions.map((a) => ({
      type: "auction" as const,
      id: a.id,
      title: a.title,
      image: a.imageUrls ? (parseImageUrls(a.imageUrls)[0] ?? null) : null,
      price: a.currentBid ?? a.startingBid,
      status: a.status,
    })),
    ...claimsales.map((c) => ({
      type: "claimsale" as const,
      id: c.id,
      title: c.title,
      image: c.coverImage,
      price: null,
      status: c.status,
    })),
  ];

  return { items };
}
