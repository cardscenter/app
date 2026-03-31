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
  const auctionId = (formData.get("auctionId") as string) || null;
  const claimsaleItemId = (formData.get("claimsaleItemId") as string) || null;
  const listingId = (formData.get("listingId") as string) || null;

  if (!sellerId || !rating || rating < 1 || rating > 5) {
    throw new Error("Ongeldige invoer");
  }

  if (sellerId === session.user.id) {
    throw new Error("Je kunt jezelf geen review geven");
  }

  await prisma.review.create({
    data: {
      rating,
      comment,
      reviewerId: session.user.id,
      sellerId,
      auctionId,
      claimsaleItemId,
      listingId,
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
      createdAt: true,
    },
  });

  if (!user) return null;

  const reviews = await prisma.review.findMany({
    where: { sellerId: userId },
    select: { rating: true },
  });

  // Fetch sales revenue data
  const [auctionSalesData, claimsaleItemsData, listingSalesData, auctionPurchasesData, claimsalePurchasesData] = await Promise.all([
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
  ]);

  const totalSales = auctionSalesData.length + claimsaleItemsData.length + listingSalesData.length;
  const totalSalesRevenue =
    auctionSalesData.reduce((sum, a) => sum + (a.finalPrice ?? 0), 0) +
    claimsaleItemsData.reduce((sum, i) => sum + i.price, 0) +
    listingSalesData.reduce((sum, l) => sum + (l.price ?? 0), 0);
  const totalPurchasesRevenue =
    auctionPurchasesData.reduce((sum, a) => sum + (a.finalPrice ?? 0), 0) +
    claimsalePurchasesData.reduce((sum, i) => sum + i.price, 0);

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
  });

  return {
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    accountType: user.accountType,
    xp: xpBreakdown.total,
    xpBreakdown,
    avgRating: Math.round(avgRating * 10) / 10,
    totalReviews,
    positivePercent,
    totalSales,
    totalPurchases: auctionPurchasesData.length + claimsalePurchasesData.length,
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
