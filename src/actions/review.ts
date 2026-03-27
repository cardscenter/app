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

  // Count sales: auctions won + claimsale items sold + listings sold
  const [auctionSales, claimsaleItemSales, listingSales] = await Promise.all([
    prisma.auction.count({
      where: { sellerId: userId, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
    }),
    prisma.claimsaleItem.count({
      where: { claimsale: { sellerId: userId }, status: "SOLD" },
    }),
    prisma.listing.count({
      where: { sellerId: userId, status: "SOLD" },
    }),
  ]);

  // Count purchases
  const [auctionPurchases, claimsalePurchases] = await Promise.all([
    prisma.auction.count({
      where: { winnerId: userId, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
    }),
    prisma.claimsaleItem.count({
      where: { buyerId: userId, status: "SOLD" },
    }),
  ]);

  const totalSales = auctionSales + claimsaleItemSales + listingSales;
  const totalPurchases = auctionPurchases + claimsalePurchases;
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;
  const positiveReviewCount = reviews.filter((r) => r.rating >= 4).length;
  const positivePercent = totalReviews > 0
    ? Math.round((positiveReviewCount / totalReviews) * 100)
    : 100;

  // Calculate XP
  const { calculateXP } = await import("@/lib/seller-levels");
  const xpBreakdown = calculateXP({
    accountCreatedAt: user.createdAt,
    totalSales,
    totalPurchases,
    positiveReviewCount,
  });

  return {
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isPro: user.accountType === "PREMIUM",
    xp: xpBreakdown.total,
    xpBreakdown,
    avgRating: Math.round(avgRating * 10) / 10,
    totalReviews,
    positivePercent,
    totalSales,
    totalPurchases,
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
