"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createReview(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Niet ingelogd");

  const sellerId = formData.get("sellerId") as string;
  const rating = parseInt(formData.get("rating") as string);
  const comment = (formData.get("comment") as string) || null;
  const auctionId = (formData.get("auctionId") as string)?.trim() || undefined;
  const claimsaleItemId = (formData.get("claimsaleItemId") as string)?.trim() || undefined;
  const listingId = (formData.get("listingId") as string)?.trim() || undefined;

  if (!sellerId || !rating || rating < 1 || rating > 5) {
    throw new Error("Ongeldige invoer");
  }

  if (sellerId === session.user.id) {
    throw new Error("Je kunt jezelf geen review geven");
  }

  // Check that buyer has at least one completed purchase from this seller
  const hasPurchase = await prisma.shippingBundle.findFirst({
    where: {
      buyerId: session.user.id,
      sellerId,
      status: { in: ["SHIPPED", "COMPLETED"] },
    },
    select: { id: true },
  });

  if (!hasPurchase) {
    throw new Error("Je kunt alleen een review plaatsen als je iets hebt gekocht bij deze verkoper");
  }

  await prisma.review.create({
    data: {
      rating,
      comment,
      reviewerId: session.user.id,
      sellerId,
      ...(auctionId ? { auctionId } : {}),
      ...(claimsaleItemId ? { claimsaleItemId } : {}),
      ...(listingId ? { listingId } : {}),
    },
  });

  revalidatePath(`/verkoper/${sellerId}`);
  revalidatePath("/dashboard/reviews");
}

export async function respondToReview(reviewId: string, response: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Niet ingelogd");

  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.sellerId !== session.user.id) {
    throw new Error("Niet gevonden of geen toegang");
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: { sellerResponse: response },
  });

  revalidatePath(`/verkoper/${review.sellerId}`);
  revalidatePath("/dashboard/reviews");
}

export async function getSellerStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      accountType: true,
      isVerified: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const reviews = await prisma.review.findMany({
    where: { sellerId: userId },
    select: { rating: true },
  });

  // Fetch sales revenue data + completed transactions + reviews given
  const [auctionSalesData, claimsaleItemsData, listingSalesData, auctionPurchasesData, claimsalePurchasesData, listingPurchasesData, completedTransactionCount, reviewsGivenCount] = await Promise.all([
    prisma.auction.findMany({
      where: { sellerId: userId, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
      select: { finalPrice: true },
    }),
    prisma.claimsaleItem.findMany({
      where: { claimsale: { sellerId: userId }, status: "SOLD" },
      select: { price: true },
    }),
    prisma.listing.findMany({
      where: { sellerId: userId, status: "SOLD" },
      select: { price: true },
    }),
    prisma.auction.findMany({
      where: { winnerId: userId, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
      select: { finalPrice: true },
    }),
    prisma.claimsaleItem.findMany({
      where: { buyerId: userId, status: "SOLD" },
      select: { price: true },
    }),
    prisma.shippingBundle.findMany({
      where: { buyerId: userId, status: "COMPLETED", listingId: { not: null } },
      select: { totalItemCost: true },
    }),
    prisma.shippingBundle.count({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: "COMPLETED",
      },
    }),
    prisma.review.count({
      where: { reviewerId: userId },
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
  const avgRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;
  const fiveStarReviewCount = reviews.filter((r) => r.rating === 5).length;
  const positiveReviewCount = reviews.filter((r) => r.rating >= 4).length;
  const positivePercent = totalReviews > 0
    ? Math.round((positiveReviewCount / totalReviews) * 100)
    : 100;

  // Calculate XP (revenue-based)
  const { calculateXP } = await import("@/lib/seller-levels");
  const xpBreakdown = calculateXP({
    accountCreatedAt: user.createdAt,
    totalSalesRevenue,
    totalPurchasesRevenue,
    fiveStarReviewCount,
    reviewsGivenCount,
    completedTransactionCount,
  });

  return {
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    accountType: user.accountType,
    isVerified: user.isVerified,
    xp: xpBreakdown.total,
    xpBreakdown,
    avgRating: Math.round(avgRating * 10) / 10,
    totalReviews,
    positivePercent,
    totalSales,
    totalPurchases: auctionPurchasesData.length + claimsalePurchasesData.length + listingPurchasesData.length,
    memberSince: user.createdAt.toLocaleDateString("nl-NL", {
      month: "short",
      year: "numeric",
    }),
  };
}

export async function getSellerReviews(userId: string) {
  return prisma.review.findMany({
    where: { sellerId: userId },
    include: {
      reviewer: { select: { displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
