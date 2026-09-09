import "server-only";
import { prisma } from "@/lib/prisma";
import type { ShopBlock } from "@/lib/shop-config";

/**
 * Lost de items van FEATURED-blokken op naar de exacte data-shapes van
 * ListingCard / AuctionCard / ClaimsaleCard. Alleen nog-actieve items van de
 * eigenaar komen terug; beëindigde/verkochte items verdwijnen stil uit het blok.
 */
export async function resolveFeaturedItems(blocks: ShopBlock[], sellerId: string) {
  const listingIds = new Set<string>();
  const auctionIds = new Set<string>();
  const claimsaleIds = new Set<string>();
  for (const b of blocks) {
    if (b.type !== "FEATURED") continue;
    for (const it of b.items) {
      if (it.type === "listing") listingIds.add(it.id);
      else if (it.type === "auction") auctionIds.add(it.id);
      else claimsaleIds.add(it.id);
    }
  }
  const now = new Date();
  const sellerSelect = { displayName: true, isVerified: true, city: true, postalCode: true, country: true } as const;

  const [listings, auctions, claimsales] = await Promise.all([
    listingIds.size
      ? prisma.listing.findMany({
          where: { id: { in: [...listingIds] }, sellerId, status: { in: ["ACTIVE", "PARTIALLY_SOLD"] } },
          select: {
            id: true,
            title: true,
            imageUrls: true,
            listingType: true,
            cardName: true,
            condition: true,
            pricingType: true,
            price: true,
            shippingCost: true,
            freeShipping: true,
            status: true,
            deliveryMethod: true,
            pickupCity: true,
            seller: { select: sellerSelect },
            upsells: { where: { expiresAt: { gt: now } }, select: { type: true, expiresAt: true } },
          },
        })
      : Promise.resolve([]),
    auctionIds.size
      ? prisma.auction.findMany({
          where: { id: { in: [...auctionIds] }, sellerId, status: { in: ["ACTIVE", "SCHEDULED"] } },
          select: {
            id: true,
            title: true,
            auctionType: true,
            currentBid: true,
            startingBid: true,
            buyNowPrice: true,
            endTime: true,
            startTime: true,
            status: true,
            imageUrls: true,
            deliveryMethod: true,
            pickupCity: true,
            seller: { select: sellerSelect },
            _count: { select: { bids: true } },
          },
        })
      : Promise.resolve([]),
    claimsaleIds.size
      ? prisma.claimsale.findMany({
          where: { id: { in: [...claimsaleIds] }, sellerId, status: { in: ["LIVE", "SCHEDULED"] } },
          select: {
            id: true,
            title: true,
            coverImage: true,
            shippingCost: true,
            status: true,
            startTime: true,
            seller: { select: sellerSelect },
            _count: { select: { items: true } },
            items: { where: { status: "AVAILABLE" }, select: { id: true, price: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    listings: new Map(listings.map((l) => [l.id, l])),
    auctions: new Map(auctions.map((a) => [a.id, a])),
    claimsales: new Map(claimsales.map((c) => [c.id, c])),
  };
}

export type ResolvedFeatured = Awaited<ReturnType<typeof resolveFeaturedItems>>;
