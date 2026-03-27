import { prisma } from "@/lib/prisma";

export type CarouselItem = {
  id: string;
  type: "auction" | "listing" | "claimsale";
  title: string;
  imageUrls: string | null;
  price: number | null;
  sellerName: string;
  endTime?: Date | string;
  auctionType?: string;
};

/**
 * Get other active items from the same seller, excluding the current item.
 */
export async function getSellerOtherItems(
  sellerId: string,
  exclude: { auctionId?: string; listingId?: string; claimsaleId?: string },
  limit = 8
): Promise<CarouselItem[]> {
  const items: CarouselItem[] = [];

  const [auctions, listings, claimsales] = await Promise.all([
    prisma.auction.findMany({
      where: {
        sellerId,
        status: "ACTIVE",
        id: exclude.auctionId ? { not: exclude.auctionId } : undefined,
      },
      include: { seller: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.listing.findMany({
      where: {
        sellerId,
        status: "ACTIVE",
        id: exclude.listingId ? { not: exclude.listingId } : undefined,
      },
      include: { seller: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.claimsale.findMany({
      where: {
        sellerId,
        status: "LIVE",
        id: exclude.claimsaleId ? { not: exclude.claimsaleId } : undefined,
      },
      include: { seller: { select: { displayName: true } } },
      orderBy: { publishedAt: "desc" },
      take: limit,
    }),
  ]);

  for (const a of auctions) {
    items.push({
      id: a.id,
      type: "auction",
      title: a.title,
      imageUrls: a.imageUrls,
      price: a.currentBid ?? a.startingBid,
      sellerName: a.seller.displayName,
      endTime: a.endTime,
      auctionType: a.auctionType,
    });
  }

  for (const l of listings) {
    items.push({
      id: l.id,
      type: "listing",
      title: l.title,
      imageUrls: l.imageUrls,
      price: l.price,
      sellerName: l.seller.displayName,
    });
  }

  for (const c of claimsales) {
    items.push({
      id: c.id,
      type: "claimsale",
      title: c.title,
      imageUrls: null,
      price: null,
      sellerName: c.seller.displayName,
    });
  }

  return items.slice(0, limit);
}

/**
 * Get similar items based on the same card set or card name.
 */
export async function getSimilarItems(
  params: {
    cardSetId?: string | null;
    cardName?: string | null;
    sellerId: string;
    excludeId: string;
    itemType: "auction" | "listing" | "claimsale";
  },
  limit = 8
): Promise<CarouselItem[]> {
  const items: CarouselItem[] = [];

  // Find items from the same card set (excluding same seller to add variety)
  if (params.cardSetId) {
    const [auctions, listings] = await Promise.all([
      prisma.auction.findMany({
        where: {
          status: "ACTIVE",
          cardSetId: params.cardSetId,
          id: params.itemType === "auction" ? { not: params.excludeId } : undefined,
        },
        include: { seller: { select: { displayName: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.listing.findMany({
        where: {
          status: "ACTIVE",
          cardSetId: params.cardSetId,
          id: params.itemType === "listing" ? { not: params.excludeId } : undefined,
        },
        include: { seller: { select: { displayName: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    for (const a of auctions) {
      items.push({
        id: a.id,
        type: "auction",
        title: a.title,
        imageUrls: a.imageUrls,
        price: a.currentBid ?? a.startingBid,
        sellerName: a.seller.displayName,
        endTime: a.endTime,
        auctionType: a.auctionType,
      });
    }

    for (const l of listings) {
      items.push({
        id: l.id,
        type: "listing",
        title: l.title,
        imageUrls: l.imageUrls,
        price: l.price,
        sellerName: l.seller.displayName,
      });
    }
  }

  return items.slice(0, limit);
}
