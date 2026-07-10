import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { calculateXP, getLevel } from "@/lib/seller-levels";
import { getRecentlySold } from "@/lib/home-recently-sold";
import type { EventListItem } from "@/components/events/event-view-types";
import { getEventPriceLabel } from "@/lib/events/format";

export type HomepageStats = {
  activeAuctions: number;
  activeClaimsales: number;
  activeListings: number;
  totalUsers: number;
};

export type PlatformStats = {
  totalCompletedSales: number;
  totalValueTraded: number;
  totalMembers: number;
  avgRating: number;
};

export type TopSeller = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  accountType: string;
  xp: number;
  levelName: string;
  levelIcon: string;
  levelColor: string;
  levelBgColor: string;
  avgRating: number;
  totalReviews: number;
  totalSales: number;
};

// Alle data hierin is globaal (geen per-user/session-velden) — counts, carousels,
// platform-stats, top-sellers, recently-sold. Daardoor kunnen we het hele resultaat
// cross-request cachen. De homepage zelf blijft dynamisch (auth/saldo/action-items
// lopen apart in page.tsx), maar deze ~22 queries collapsen naar een cache-hit.
// 60s revalidate: live-auction-carousels zijn max 1 min stale (de detailpagina's
// blijven real-time), maar de DB wordt nog maar 1×/minuut bevraagd i.p.v. per request.
async function fetchHomepageData() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [
    activeAuctions,
    activeClaimsales,
    activeListings,
    totalUsers,
    recentAuctions,
    recentClaimsales,
    recentListings,
    endingSoonAuctions,
    trendingAuctions,
    sponsoredAuctions,
    sponsoredListings,
    spotlightEventsRaw,
    platformStatsRaw,
  ] = await Promise.all([
    // Counts
    prisma.auction.count({ where: { status: "ACTIVE" } }),
    prisma.claimsale.count({ where: { status: "LIVE" } }),
    prisma.listing.count({ where: { status: { in: ["ACTIVE", "PARTIALLY_SOLD"] } } }),
    prisma.user.count(),

    // Recent items (8 each for carousels)
    prisma.auction.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        seller: { select: { displayName: true, avatarUrl: true, city: true, postalCode: true, country: true } },
        _count: { select: { bids: true } },
      },
    }),
    prisma.claimsale.findMany({
      where: { status: "LIVE" },
      orderBy: { publishedAt: "desc" },
      take: 8,
      include: {
        seller: { select: { displayName: true, city: true, postalCode: true, country: true } },
        items: { where: { status: "AVAILABLE" }, select: { id: true, price: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.listing.findMany({
      where: { status: { in: ["ACTIVE", "PARTIALLY_SOLD"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        seller: { select: { displayName: true, isVerified: true, city: true, postalCode: true, country: true } },
        upsells: { where: { expiresAt: { gt: now } }, select: { type: true, expiresAt: true } },
      },
    }),

    // Ending soon (within 24h)
    prisma.auction.findMany({
      where: {
        status: "ACTIVE",
        endTime: { gt: now, lt: in24h },
      },
      orderBy: { endTime: "asc" },
      take: 8,
      include: {
        seller: { select: { displayName: true, avatarUrl: true, city: true, postalCode: true, country: true } },
        _count: { select: { bids: true } },
      },
    }),

    // Trending (most bids)
    prisma.auction.findMany({
      where: { status: "ACTIVE" },
      orderBy: { bids: { _count: "desc" } },
      take: 12,
      include: {
        seller: { select: { displayName: true, avatarUrl: true, city: true, postalCode: true, country: true } },
        _count: { select: { bids: true } },
      },
    }),

    // Sponsored auctions
    prisma.auction.findMany({
      where: {
        status: "ACTIVE",
        upsells: { some: { type: "HOMEPAGE_SPOTLIGHT", expiresAt: { gt: now } } },
      },
      take: 4,
      include: {
        seller: { select: { displayName: true, avatarUrl: true, city: true, postalCode: true, country: true } },
        _count: { select: { bids: true } },
      },
    }),

    // Sponsored listings
    prisma.listing.findMany({
      where: {
        status: { in: ["ACTIVE", "PARTIALLY_SOLD"] },
        upsells: { some: { type: "HOMEPAGE_SPOTLIGHT", expiresAt: { gt: now } } },
      },
      take: 4,
      include: {
        seller: { select: { displayName: true, isVerified: true, city: true, postalCode: true, country: true } },
        upsells: { where: { expiresAt: { gt: now } }, select: { type: true, expiresAt: true } },
      },
    }),

    // Spotlight events — LIVE events met een actieve HOMEPAGE_SPOTLIGHT-upsell.
    prisma.event.findMany({
      where: {
        status: "LIVE",
        endTime: { gte: now },
        upsells: { some: { type: "HOMEPAGE_SPOTLIGHT", expiresAt: { gt: now } } },
      },
      orderBy: { startTime: "asc" },
      take: 8,
    }),

    // Platform stats
    getPlatformStats(),
  ]);

  const spotlightEvents: EventListItem[] = spotlightEventsRaw.map((e) => ({
    id: e.id,
    title: e.title,
    eventType: e.eventType,
    venueName: e.venueName,
    street: e.street,
    houseNumber: e.houseNumber,
    postalCode: e.postalCode,
    city: e.city,
    country: e.country,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    earlyAccessTime: e.earlyAccessTime?.toISOString() ?? null,
    timezone: e.timezone,
    coverImage: e.coverImage,
    entryType: e.entryType,
    entryPrice: e.entryPrice,
    entryCurrency: e.entryCurrency,
    priceLabel: getEventPriceLabel(e),
    maxVisitors: e.maxVisitors,
    isOfficial: e.isOfficial,
    lat: e.lat,
    lng: e.lng,
    featured: true,
  }));

  // Fase 36 additions: recently-sold-for + testimonials gating count
  const [recentlySoldItems, fiveStarReviewCount] = await Promise.all([
    getRecentlySold(8),
    prisma.review.count({ where: { rating: 5 } }),
  ]);

  // Filter trending: min 2 bids
  const filteredTrending = trendingAuctions.filter((a) => (a._count?.bids ?? 0) >= 2).slice(0, 8);

  // Top sellers (fetched separately due to complexity)
  const topSellers = await getTopSellers();

  const stats: HomepageStats = { activeAuctions, activeClaimsales, activeListings, totalUsers };

  return {
    stats,
    recentAuctions,
    recentClaimsales,
    recentListings,
    endingSoonAuctions,
    trendingAuctions: filteredTrending,
    sponsoredAuctions,
    sponsoredListings,
    spotlightEvents,
    topSellers,
    platformStats: platformStatsRaw,
    recentlySoldItems,
    fiveStarReviewCount,
  };
}

// Cross-request cache rond de globale homepage-data. keyParts vast (geen args),
// tag "homepage" zodat we later desgewenst gericht kunnen invalideren.
export const getHomepageData = unstable_cache(
  fetchHomepageData,
  ["homepage-data-v1"],
  { revalidate: 60, tags: ["homepage"] },
);

async function getPlatformStats(): Promise<PlatformStats> {
  const [completedBundles, totalMembers, reviewStats] = await Promise.all([
    prisma.shippingBundle.findMany({
      where: { status: "COMPLETED" },
      select: { totalCost: true },
    }),
    prisma.user.count(),
    prisma.review.aggregate({
      _avg: { rating: true },
    }),
  ]);

  return {
    totalCompletedSales: completedBundles.length,
    totalValueTraded: completedBundles.reduce((sum, b) => sum + b.totalCost, 0),
    totalMembers: totalMembers,
    avgRating: reviewStats._avg.rating ?? 0,
  };
}

async function getTopSellers(): Promise<TopSeller[]> {
  // Get top 6 sellers by completed sale count
  const topSellerBundles = await prisma.shippingBundle.groupBy({
    by: ["sellerId"],
    where: { status: "COMPLETED" },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 6,
  });

  if (topSellerBundles.length === 0) return [];

  const sellerIds = topSellerBundles.map((b) => b.sellerId);

  // Fetch user data + stats in parallel
  const [users, salesRevenue, purchasesRevenue, fiveStarReviews, reviewsGiven, completedTxns, reviewStats] =
    await Promise.all([
      prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          isVerified: true,
          accountType: true,
          createdAt: true,
        },
      }),
      // Sales revenue per seller
      prisma.shippingBundle.groupBy({
        by: ["sellerId"],
        where: { sellerId: { in: sellerIds }, status: "COMPLETED" },
        _sum: { totalItemCost: true },
      }),
      // Purchases revenue per seller
      prisma.shippingBundle.groupBy({
        by: ["buyerId"],
        where: { buyerId: { in: sellerIds }, status: "COMPLETED" },
        _sum: { totalItemCost: true },
      }),
      // 5-star reviews per seller
      prisma.review.groupBy({
        by: ["sellerId"],
        where: { sellerId: { in: sellerIds }, rating: 5 },
        _count: { id: true },
      }),
      // Reviews given per seller
      prisma.review.groupBy({
        by: ["reviewerId"],
        where: { reviewerId: { in: sellerIds } },
        _count: { id: true },
      }),
      // Completed transactions per seller
      prisma.shippingBundle.groupBy({
        by: ["sellerId"],
        where: { sellerId: { in: sellerIds }, status: "COMPLETED" },
        _count: { id: true },
      }),
      // Average review rating per seller
      prisma.review.groupBy({
        by: ["sellerId"],
        where: { sellerId: { in: sellerIds } },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const salesMap = new Map(salesRevenue.map((s) => [s.sellerId, s._sum.totalItemCost ?? 0]));
  const purchasesMap = new Map(purchasesRevenue.map((p) => [p.buyerId, p._sum.totalItemCost ?? 0]));
  const fiveStarMap = new Map(fiveStarReviews.map((r) => [r.sellerId, r._count.id]));
  const reviewsGivenMap = new Map(reviewsGiven.map((r) => [r.reviewerId, r._count.id]));
  const completedTxnMap = new Map(completedTxns.map((t) => [t.sellerId, t._count.id]));
  const reviewStatsMap = new Map(
    reviewStats.map((r) => [r.sellerId, { avg: r._avg.rating ?? 0, count: r._count.id }])
  );

  return topSellerBundles
    .map((bundle) => {
      const user = userMap.get(bundle.sellerId);
      if (!user) return null;

      const xpData = calculateXP({
        accountCreatedAt: user.createdAt,
        totalSalesRevenue: salesMap.get(user.id) ?? 0,
        totalPurchasesRevenue: purchasesMap.get(user.id) ?? 0,
        fiveStarReviewCount: fiveStarMap.get(user.id) ?? 0,
        reviewsGivenCount: reviewsGivenMap.get(user.id) ?? 0,
        completedTransactionCount: completedTxnMap.get(user.id) ?? 0,
      });

      const level = getLevel(xpData.total);
      const stats = reviewStatsMap.get(user.id) ?? { avg: 0, count: 0 };

      return {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
        accountType: user.accountType,
        xp: xpData.total,
        levelName: level.name,
        levelIcon: level.icon,
        levelColor: level.color,
        levelBgColor: level.bgColor,
        avgRating: stats.avg,
        totalReviews: stats.count,
        totalSales: bundle._count.id,
      };
    })
    .filter((s): s is TopSeller => s !== null);
}
