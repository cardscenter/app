"use server";

import { prisma } from "@/lib/prisma";

export interface SearchFilters {
  q?: string;
  type?: "auction" | "claimsale" | "listing";
  condition?: string;
  cardSetId?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "ending_soon" | "most_bids";
}

export interface SearchResult {
  id: string;
  type: "auction" | "claimsale" | "listing";
  title: string;
  price: number | null;
  sellerName: string;
  createdAt: string;
  // auction-specific
  endTime?: string;
  bidCount?: number;
  auctionType?: string;
  currentBid?: number | null;
  startingBid?: number;
  buyNowPrice?: number | null;
  imageUrls?: string | null;
  // claimsale-specific
  itemCount?: number;
  priceRange?: { min: number; max: number } | null;
  shippingCost?: number;
  totalItems?: number;
  // listing-specific
  cardName?: string;
  condition?: string;
  pricingType?: string;
}

export async function searchAll(
  filters: SearchFilters
): Promise<{ results: SearchResult[]; total: number }> {
  const query = filters.q?.trim() || "";
  const results: SearchResult[] = [];

  const shouldSearchAuctions =
    !filters.type || filters.type === "auction";
  const shouldSearchClaimsales =
    !filters.type || filters.type === "claimsale";
  const shouldSearchListings =
    !filters.type || filters.type === "listing";

  // Build text search conditions
  const textConditions = query
    ? {
        OR: [
          { title: { contains: query } },
          { cardName: { contains: query } },
          { description: { contains: query } },
        ],
      }
    : {};

  const [auctions, claimsales, listings] = await Promise.all([
    // Auctions
    shouldSearchAuctions
      ? prisma.auction.findMany({
          where: {
            status: "ACTIVE",
            ...textConditions,
            ...(filters.condition ? { condition: filters.condition } : {}),
            ...(filters.cardSetId ? { cardSetId: filters.cardSetId } : {}),
            ...(filters.minPrice || filters.maxPrice
              ? {
                  currentBid: {
                    ...(filters.minPrice ? { gte: filters.minPrice } : {}),
                    ...(filters.maxPrice ? { lte: filters.maxPrice } : {}),
                  },
                }
              : {}),
          },
          include: {
            seller: { select: { displayName: true } },
            _count: { select: { bids: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),

    // Claimsales
    shouldSearchClaimsales
      ? prisma.claimsale.findMany({
          where: {
            status: "LIVE",
            ...(query
              ? {
                  OR: [
                    { title: { contains: query } },
                    { description: { contains: query } },
                    {
                      items: {
                        some: { cardName: { contains: query } },
                      },
                    },
                  ],
                }
              : {}),
            ...(filters.condition || filters.cardSetId || filters.minPrice || filters.maxPrice
              ? {
                  items: {
                    some: {
                      status: "AVAILABLE",
                      ...(filters.condition
                        ? { condition: filters.condition }
                        : {}),
                      ...(filters.cardSetId
                        ? { cardSetId: filters.cardSetId }
                        : {}),
                      ...(filters.minPrice || filters.maxPrice
                        ? {
                            price: {
                              ...(filters.minPrice
                                ? { gte: filters.minPrice }
                                : {}),
                              ...(filters.maxPrice
                                ? { lte: filters.maxPrice }
                                : {}),
                            },
                          }
                        : {}),
                    },
                  },
                }
              : {}),
          },
          include: {
            seller: { select: { displayName: true } },
            _count: { select: { items: true } },
            items: {
              where: { status: "AVAILABLE" },
              select: { id: true, price: true },
            },
          },
          orderBy: { publishedAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),

    // Listings
    shouldSearchListings
      ? prisma.listing.findMany({
          where: {
            status: "ACTIVE",
            ...textConditions,
            ...(filters.condition ? { condition: filters.condition } : {}),
            ...(filters.cardSetId ? { cardSetId: filters.cardSetId } : {}),
            ...(filters.minPrice || filters.maxPrice
              ? {
                  price: {
                    ...(filters.minPrice ? { gte: filters.minPrice } : {}),
                    ...(filters.maxPrice ? { lte: filters.maxPrice } : {}),
                  },
                }
              : {}),
          },
          include: {
            seller: { select: { displayName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  // Map auctions to SearchResult
  for (const a of auctions) {
    results.push({
      id: a.id,
      type: "auction",
      title: a.title,
      price: a.currentBid ?? a.startingBid,
      sellerName: a.seller.displayName,
      createdAt: a.createdAt.toISOString(),
      endTime: a.endTime.toISOString(),
      bidCount: a._count.bids,
      auctionType: a.auctionType,
      currentBid: a.currentBid,
      startingBid: a.startingBid,
      buyNowPrice: a.buyNowPrice,
      imageUrls: a.imageUrls,
    });
  }

  // Map claimsales to SearchResult
  for (const c of claimsales) {
    const prices = c.items.map((i) => i.price);
    results.push({
      id: c.id,
      type: "claimsale",
      title: c.title,
      price: prices.length > 0 ? Math.min(...prices) : null,
      sellerName: c.seller.displayName,
      createdAt: c.createdAt.toISOString(),
      itemCount: c.items.length,
      totalItems: c._count.items,
      priceRange:
        prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : null,
      shippingCost: c.shippingCost,
    });
  }

  // Map listings to SearchResult
  for (const l of listings) {
    results.push({
      id: l.id,
      type: "listing",
      title: l.title,
      price: l.price,
      sellerName: l.seller.displayName,
      createdAt: l.createdAt.toISOString(),
      cardName: l.cardName ?? undefined,
      condition: l.condition ?? undefined,
      pricingType: l.pricingType,
      shippingCost: l.shippingCost,
      imageUrls: l.imageUrls,
    });
  }

  // Sort results
  sortResults(results, filters.sort || "newest");

  return { results, total: results.length };
}

function sortResults(
  results: SearchResult[],
  sort: string
): void {
  switch (sort) {
    case "price_asc":
      results.sort(
        (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)
      );
      break;
    case "price_desc":
      results.sort(
        (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)
      );
      break;
    case "ending_soon":
      results.sort((a, b) => {
        const aEnd = a.endTime
          ? new Date(a.endTime).getTime()
          : Infinity;
        const bEnd = b.endTime
          ? new Date(b.endTime).getTime()
          : Infinity;
        return aEnd - bEnd;
      });
      break;
    case "most_bids":
      results.sort((a, b) => (b.bidCount ?? 0) - (a.bidCount ?? 0));
      break;
    case "newest":
    default:
      results.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
      break;
  }
}
