import { prisma } from "@/lib/prisma";

export async function fetchSalesData(userId: string, since: Date) {
  const [auctions, claimsaleItems, listings] = await Promise.all([
    prisma.auction.findMany({
      where: {
        sellerId: userId,
        status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] },
        updatedAt: { gte: since },
      },
      select: { finalPrice: true, updatedAt: true },
    }),
    prisma.claimsaleItem.findMany({
      where: {
        claimsale: { sellerId: userId },
        status: "SOLD",
        updatedAt: { gte: since },
      },
      select: { price: true, updatedAt: true },
    }),
    prisma.listing.findMany({
      where: {
        sellerId: userId,
        status: "SOLD",
        updatedAt: { gte: since },
      },
      select: { price: true, updatedAt: true },
    }),
  ]);

  return {
    auctions: auctions.map((a) => ({ date: a.updatedAt, value: a.finalPrice ?? 0 })),
    claimsales: claimsaleItems.map((i) => ({ date: i.updatedAt, value: i.price })),
    listings: listings.map((l) => ({ date: l.updatedAt, value: l.price ?? 0 })),
  };
}

export async function fetchBuyerData(userId: string, since: Date) {
  const [wonAuctions, boughtClaimsaleItems, boughtListings] = await Promise.all([
    prisma.auction.findMany({
      where: {
        winnerId: userId,
        status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] },
        updatedAt: { gte: since },
      },
      select: { finalPrice: true, updatedAt: true },
    }),
    prisma.claimsaleItem.findMany({
      where: {
        buyerId: userId,
        status: "SOLD",
        updatedAt: { gte: since },
      },
      select: { price: true, updatedAt: true },
    }),
    prisma.listing.findMany({
      where: {
        buyerId: userId,
        status: "SOLD",
        updatedAt: { gte: since },
      },
      select: { price: true, updatedAt: true },
    }),
  ]);

  return {
    auctions: wonAuctions.map((a) => ({ date: a.updatedAt, value: a.finalPrice ?? 0 })),
    claimsales: boughtClaimsaleItems.map((i) => ({ date: i.updatedAt, value: i.price })),
    listings: boughtListings.map((l) => ({ date: l.updatedAt, value: l.price ?? 0 })),
  };
}

export async function fetchSellerPerformance(userId: string, since: Date) {
  const [bundles, reviews] = await Promise.all([
    prisma.shippingBundle.findMany({
      where: {
        sellerId: userId,
        status: { in: ["SHIPPED", "COMPLETED"] },
        createdAt: { gte: since },
      },
      select: { createdAt: true, shippedAt: true, deliveredAt: true },
    }),
    prisma.review.findMany({
      where: {
        sellerId: userId,
        createdAt: { gte: since },
      },
      select: {
        rating: true,
        packagingRating: true,
        shippingRating: true,
        communicationRating: true,
        createdAt: true,
      },
    }),
  ]);

  return { bundles, reviews };
}

export async function fetchCommissionData(userId: string, since: Date) {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: "COMMISSION",
      createdAt: { gte: since },
    },
    select: { amount: true, createdAt: true },
  });

  return transactions;
}

export async function fetchXPData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      accountType: true,
      bonusXP: true,
    },
  });

  if (!user) return null;

  const [
    auctionSalesRevenue,
    claimsaleSalesRevenue,
    listingSalesRevenue,
    auctionPurchaseRevenue,
    claimsalePurchaseRevenue,
    listingPurchaseRevenue,
    fiveStarReviews,
    reviewsGiven,
    completedBundles,
  ] = await Promise.all([
    prisma.auction.aggregate({
      where: { sellerId: userId, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
      _sum: { finalPrice: true },
    }),
    prisma.claimsaleItem.aggregate({
      where: { claimsale: { sellerId: userId }, status: "SOLD" },
      _sum: { price: true },
    }),
    prisma.listing.aggregate({
      where: { sellerId: userId, status: "SOLD" },
      _sum: { price: true },
    }),
    prisma.auction.aggregate({
      where: { winnerId: userId, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
      _sum: { finalPrice: true },
    }),
    prisma.claimsaleItem.aggregate({
      where: { buyerId: userId, status: "SOLD" },
      _sum: { price: true },
    }),
    prisma.listing.aggregate({
      where: { buyerId: userId, status: "SOLD" },
      _sum: { price: true },
    }),
    prisma.review.count({ where: { sellerId: userId, rating: 5 } }),
    prisma.review.count({ where: { reviewerId: userId } }),
    prisma.shippingBundle.count({ where: { sellerId: userId, status: "COMPLETED" } }),
  ]);

  return {
    accountCreatedAt: user.createdAt,
    accountType: user.accountType,
    bonusXP: user.bonusXP,
    totalSalesRevenue:
      (auctionSalesRevenue._sum.finalPrice ?? 0) +
      (claimsaleSalesRevenue._sum.price ?? 0) +
      (listingSalesRevenue._sum.price ?? 0),
    totalPurchasesRevenue:
      (auctionPurchaseRevenue._sum.finalPrice ?? 0) +
      (claimsalePurchaseRevenue._sum.price ?? 0) +
      (listingPurchaseRevenue._sum.price ?? 0),
    fiveStarReviewCount: fiveStarReviews,
    reviewsGivenCount: reviewsGiven,
    completedTransactionCount: completedBundles,
  };
}
