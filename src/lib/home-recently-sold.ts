import { prisma } from "@/lib/prisma";

export type RecentlySoldItem = {
  bundleId: string;
  kind: "auction" | "listing" | "bundle" | "claimsale";
  title: string;
  imageUrl: string | null;
  soldPrice: number;
  soldAt: Date;
  sellerDisplayName: string;
  sellerId: string;
};

function parseFirstImage(imageUrls: string | null | undefined): string | null {
  if (!imageUrls) return null;
  try {
    const parsed = JSON.parse(imageUrls) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
      return parsed[0];
    }
  } catch {
    // Fallback for non-JSON legacy storage (raw URL string)
    if (typeof imageUrls === "string" && imageUrls.startsWith("/")) return imageUrls;
  }
  return null;
}

/**
 * Fetches the most recently delivered orders for the homepage "recently sold"
 * social-proof row. Excludes EXTERNAL pickup bundles (off-platform, no price
 * trail) and bundles without a delivered timestamp.
 *
 * Returns enriched item-level data per bundle:
 * - Auction: auction title + finalPrice
 * - Single listing: listing title + bundle.totalItemCost
 * - Multi-listing bundle: "{N} items" label + bundle.totalItemCost
 * - Claimsale: "{N} kaarten uit {claimsale.title}" + bundle.totalItemCost
 *
 * No buyer information is exposed.
 */
export async function getRecentlySold(limit = 8): Promise<RecentlySoldItem[]> {
  const bundles = await prisma.shippingBundle.findMany({
    where: {
      status: "COMPLETED",
      paymentMode: "PLATFORM",
      deliveredAt: { not: null },
    },
    orderBy: { deliveredAt: "desc" },
    take: limit,
    select: {
      id: true,
      totalItemCost: true,
      deliveredAt: true,
      sellerId: true,
      seller: { select: { displayName: true } },
      auction: {
        select: {
          title: true,
          imageUrls: true,
          finalPrice: true,
        },
      },
      listing: {
        select: {
          title: true,
          imageUrls: true,
        },
      },
      bundleListings: {
        select: {
          listing: {
            select: { title: true, imageUrls: true },
          },
        },
      },
      items: {
        where: { status: "SOLD" },
        select: {
          cardName: true,
          imageUrls: true,
          claimsale: { select: { title: true, coverImage: true } },
        },
      },
    },
  });

  const enriched: RecentlySoldItem[] = [];

  for (const bundle of bundles) {
    if (!bundle.deliveredAt) continue;

    const sellerDisplayName = bundle.seller?.displayName ?? "Verkoper";
    const base = {
      bundleId: bundle.id,
      soldAt: bundle.deliveredAt,
      sellerDisplayName,
      sellerId: bundle.sellerId,
    };

    if (bundle.auction) {
      enriched.push({
        ...base,
        kind: "auction",
        title: bundle.auction.title,
        imageUrl: parseFirstImage(bundle.auction.imageUrls),
        soldPrice: bundle.auction.finalPrice ?? bundle.totalItemCost,
      });
      continue;
    }

    if (bundle.listing) {
      enriched.push({
        ...base,
        kind: "listing",
        title: bundle.listing.title,
        imageUrl: parseFirstImage(bundle.listing.imageUrls),
        soldPrice: bundle.totalItemCost,
      });
      continue;
    }

    if (bundle.bundleListings.length > 0) {
      const first = bundle.bundleListings[0]?.listing;
      enriched.push({
        ...base,
        kind: "bundle",
        title: `Bundel van ${bundle.bundleListings.length} items`,
        imageUrl: first ? parseFirstImage(first.imageUrls) : null,
        soldPrice: bundle.totalItemCost,
      });
      continue;
    }

    if (bundle.items.length > 0) {
      const first = bundle.items[0];
      const claimsaleTitle = first?.claimsale?.title;
      enriched.push({
        ...base,
        kind: "claimsale",
        title: claimsaleTitle
          ? `${bundle.items.length} kaarten uit "${claimsaleTitle}"`
          : `${bundle.items.length} claimsale-kaarten`,
        imageUrl: parseFirstImage(first?.imageUrls) ?? first?.claimsale?.coverImage ?? null,
        soldPrice: bundle.totalItemCost,
      });
      continue;
    }
  }

  return enriched;
}
