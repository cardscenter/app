import { prisma } from "@/lib/prisma";
import { calculateXP } from "@/lib/seller-levels";
import type { SellerInfo } from "@/components/ui/seller-info-block";

export async function getSellerInfo(sellerId: string): Promise<SellerInfo | null> {
  const user = await prisma.user.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      city: true,
      country: true,
      accountType: true,
      isVerified: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const [reviews, auctionSalesData, claimsaleItemsData, listingSalesData, auctionPurchasesData, claimsalePurchasesData, listingPurchasesData, completedTransactionCount, reviewsGivenCount] =
    await Promise.all([
      prisma.review.findMany({
        where: { sellerId },
        select: { rating: true },
      }),
      prisma.auction.findMany({
        where: { sellerId, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
        select: { finalPrice: true },
      }),
      prisma.claimsaleItem.findMany({
        where: { claimsale: { sellerId }, status: "SOLD" },
        select: { price: true },
      }),
      prisma.listing.findMany({
        where: { sellerId, status: "SOLD" },
        select: { price: true },
      }),
      prisma.auction.findMany({
        where: { winnerId: sellerId, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
        select: { finalPrice: true },
      }),
      prisma.claimsaleItem.findMany({
        where: { buyerId: sellerId, status: "SOLD" },
        select: { price: true },
      }),
      prisma.shippingBundle.findMany({
        where: { buyerId: sellerId, status: "COMPLETED", listingId: { not: null } },
        select: { totalItemCost: true },
      }),
      prisma.shippingBundle.count({
        where: {
          OR: [{ buyerId: sellerId }, { sellerId }],
          status: "COMPLETED",
        },
      }),
      prisma.review.count({
        where: { reviewerId: sellerId },
      }),
    ]);

  const totalSales = auctionSalesData.length + claimsaleItemsData.length + listingSalesData.length;
  const totalSalesRevenue =
    auctionSalesData.reduce((sum, a) => sum + (a.finalPrice ?? 0), 0) +
    claimsaleItemsData.reduce((sum, i) => sum + i.price, 0) +
    listingSalesData.reduce((sum, l) => sum + (l.price ?? 0), 0);
  const totalPurchasesRevenue =
    auctionPurchasesData.reduce((sum, a) => sum + (a.finalPrice ?? 0), 0) +
    claimsalePurchasesData.reduce((sum, i) => sum + i.price, 0) +
    listingPurchasesData.reduce((sum, l) => sum + l.totalItemCost, 0);

  const totalReviews = reviews.length;
  const avgRating =
    totalReviews > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : 0;
  const fiveStarReviewCount = reviews.filter((r) => r.rating === 5).length;

  const xpBreakdown = calculateXP({
    accountCreatedAt: user.createdAt,
    totalSalesRevenue,
    totalPurchasesRevenue,
    fiveStarReviewCount,
    reviewsGivenCount,
    completedTransactionCount,
  });

  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    city: user.city,
    country: user.country,
    accountType: user.accountType,
    isVerified: user.isVerified,
    xp: xpBreakdown.total,
    avgRating,
    totalReviews,
    totalSales,
  };
}
