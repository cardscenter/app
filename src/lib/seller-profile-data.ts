import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSellerStats } from "@/actions/review";
import { parseShopBlocks } from "@/lib/validations/shop";
import type { ShopBlock } from "@/lib/shop-config";

/**
 * Eén data-bron voor het publieke verkopersprofiel (/verkoper/[id]) en de
 * winkelpagina (/winkel/[slug]) — Fase 45. React-`cache()`d zodat page +
 * generateMetadata dezelfde query delen.
 */

export type SellerProfileUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  accountType: string;
  accountKind: string;
  companyName: string | null;
  cocNumber: string | null;
  vatNumber: string | null;
  city: string | null;
  country: string | null;
  createdAt: Date;
  isVerified: boolean;
  isIbanVerified: boolean;
  isAddressVerified: boolean;
  profileBanner: string | null;
  shopSlug: string | null;
  shopBannerUrl: string | null;
  shopTagline: string | null;
  shopPublished: boolean;
  shopBlocks: ShopBlock[];
};

export type SellerReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  sellerResponse: string | null;
  createdAt: Date;
  reviewer: { displayName: string; avatarUrl: string | null };
  itemTitle: string | null;
  itemHref: string | null;
};

export type SellerOfferRow = {
  type: "auction" | "listing" | "claimsale";
  id: string;
  title: string;
  price: number | null;
  status: string;
  createdAt: Date;
  href: string;
};

export type SellerSaleRow = {
  id: string;
  orderNumber: string;
  type: "auction" | "listing" | "claimsale" | "bundle";
  title: string;
  itemCount: number;
  total: number;
  status: string;
  createdAt: Date;
};

export type SellerProfileData = {
  user: SellerProfileUser;
  stats: NonNullable<Awaited<ReturnType<typeof getSellerStats>>>;
  reviews: SellerReviewRow[];
  activeOffers: SellerOfferRow[];
  activeCounts: { auctions: number; listings: number; claimsales: number };
  /** Alleen gevuld voor de eigenaar. */
  recentSales: SellerSaleRow[] | null;
};

export const getSellerProfileData = cache(
  async (userId: string, viewerId: string | null): Promise<SellerProfileData | null> => {
    const [user, stats] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          accountType: true,
          accountKind: true,
          companyName: true,
          cocNumber: true,
          vatNumber: true,
          city: true,
          country: true,
          createdAt: true,
          isVerified: true,
          isIbanVerified: true,
          isAddressVerified: true,
          profileBanner: true,
          shopSlug: true,
          shopBannerUrl: true,
          shopTagline: true,
          shopPublished: true,
          shopBlocks: true,
        },
      }),
      getSellerStats(userId),
    ]);
    if (!user || !stats) return null;
    const isOwner = viewerId === userId;

    const [reviewsRaw, auctions, listings, claimsales, auctionCount, listingCount, claimsaleCount, salesRaw] =
      await Promise.all([
        prisma.review.findMany({
          where: { sellerId: userId },
          include: { reviewer: { select: { displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.auction.findMany({
          where: { sellerId: userId, status: { in: ["ACTIVE", "SCHEDULED"] } },
          select: { id: true, title: true, currentBid: true, startingBid: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.listing.findMany({
          where: { sellerId: userId, status: { in: ["ACTIVE", "PARTIALLY_SOLD"] } },
          select: { id: true, title: true, price: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.claimsale.findMany({
          where: { sellerId: userId, status: { in: ["LIVE", "SCHEDULED"] } },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            items: { where: { status: "AVAILABLE" }, select: { price: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.auction.count({ where: { sellerId: userId, status: { in: ["ACTIVE", "SCHEDULED"] } } }),
        prisma.listing.count({ where: { sellerId: userId, status: { in: ["ACTIVE", "PARTIALLY_SOLD"] } } }),
        prisma.claimsale.count({ where: { sellerId: userId, status: { in: ["LIVE", "SCHEDULED"] } } }),
        isOwner
          ? prisma.shippingBundle.findMany({
              where: { sellerId: userId, status: { in: ["PAID", "SHIPPED", "COMPLETED"] } },
              select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
                totalCost: true,
                listing: { select: { title: true } },
                auction: { select: { title: true } },
                items: { select: { cardName: true } },
                bundleListings: { select: { listing: { select: { title: true } } } },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            })
          : Promise.resolve(null),
      ]);

    // Item-titels bij reviews: Review heeft alleen losse id-kolommen, dus
    // gebatcht opzoeken per type.
    const auctionIds = [...new Set(reviewsRaw.map((r) => r.auctionId).filter((x): x is string => !!x))];
    const listingIds = [...new Set(reviewsRaw.map((r) => r.listingId).filter((x): x is string => !!x))];
    const itemIds = [...new Set(reviewsRaw.map((r) => r.claimsaleItemId).filter((x): x is string => !!x))];
    const [revAuctions, revListings, revItems] = await Promise.all([
      auctionIds.length ? prisma.auction.findMany({ where: { id: { in: auctionIds } }, select: { id: true, title: true } }) : [],
      listingIds.length ? prisma.listing.findMany({ where: { id: { in: listingIds } }, select: { id: true, title: true } }) : [],
      itemIds.length
        ? prisma.claimsaleItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, cardName: true, claimsaleId: true } })
        : [],
    ]);
    const aMap = new Map(revAuctions.map((a) => [a.id, a.title]));
    const lMap = new Map(revListings.map((l) => [l.id, l.title]));
    const iMap = new Map(revItems.map((i) => [i.id, i]));

    const reviews: SellerReviewRow[] = reviewsRaw.map((r) => {
      let itemTitle: string | null = null;
      let itemHref: string | null = null;
      if (r.auctionId && aMap.has(r.auctionId)) {
        itemTitle = aMap.get(r.auctionId)!;
        itemHref = `/veilingen/${r.auctionId}`;
      } else if (r.listingId && lMap.has(r.listingId)) {
        itemTitle = lMap.get(r.listingId)!;
        itemHref = `/marktplaats/${r.listingId}`;
      } else if (r.claimsaleItemId && iMap.has(r.claimsaleItemId)) {
        const it = iMap.get(r.claimsaleItemId)!;
        itemTitle = it.cardName;
        itemHref = `/claimsales/${it.claimsaleId}`;
      }
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        sellerResponse: r.sellerResponse,
        createdAt: r.createdAt,
        reviewer: r.reviewer,
        itemTitle,
        itemHref,
      };
    });

    const activeOffers: SellerOfferRow[] = [
      ...auctions.map((a) => ({
        type: "auction" as const,
        id: a.id,
        title: a.title,
        price: a.currentBid ?? a.startingBid,
        status: a.status,
        createdAt: a.createdAt,
        href: `/veilingen/${a.id}`,
      })),
      ...listings.map((l) => ({
        type: "listing" as const,
        id: l.id,
        title: l.title,
        price: l.price,
        status: l.status,
        createdAt: l.createdAt,
        href: `/marktplaats/${l.id}`,
      })),
      ...claimsales.map((c) => ({
        type: "claimsale" as const,
        id: c.id,
        title: c.title,
        price: c.items.length ? Math.min(...c.items.map((i) => i.price)) : null,
        status: c.status,
        createdAt: c.createdAt,
        href: `/claimsales/${c.id}`,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);

    const recentSales: SellerSaleRow[] | null = salesRaw
      ? salesRaw.map((b) => {
          let type: SellerSaleRow["type"];
          let title: string;
          let itemCount = 1;
          if (b.auction) {
            type = "auction";
            title = b.auction.title;
          } else if (b.listing) {
            type = "listing";
            title = b.listing.title;
          } else if (b.bundleListings.length > 0) {
            type = "bundle";
            title = b.bundleListings.map((bl) => bl.listing.title).join(", ");
            itemCount = b.bundleListings.length;
          } else {
            type = "claimsale";
            title = b.items.map((i) => i.cardName).slice(0, 3).join(", ") + (b.items.length > 3 ? " …" : "");
            itemCount = b.items.length;
          }
          return {
            id: b.id,
            orderNumber: b.orderNumber,
            type,
            title,
            itemCount,
            total: b.totalCost,
            status: b.status,
            createdAt: b.createdAt,
          };
        })
      : null;

    return {
      user: { ...user, shopBlocks: parseShopBlocks(user.shopBlocks) },
      stats,
      reviews,
      activeOffers,
      activeCounts: { auctions: auctionCount, listings: listingCount, claimsales: claimsaleCount },
      recentSales,
    };
  },
);
