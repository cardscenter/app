import { prisma } from "@/lib/prisma";

const RESERVE_PERCENTAGE = 0.4; // 40% of bid amount must be reserved

/**
 * Calculate the available balance (what the user can actually spend/bid with).
 */
export function getAvailableBalance(user: { balance: number; reservedBalance: number }): number {
  return Math.max(0, user.balance - user.reservedBalance);
}

/**
 * Calculate how much should be reserved for a given bid amount (40%).
 */
export function calculateReserveAmount(bidAmount: number): number {
  return Math.round(bidAmount * RESERVE_PERCENTAGE * 100) / 100;
}

/**
 * Get the current reserved amount for a specific user on a specific auction.
 * This is 40% of whichever is higher: their highest manual bid or their autobid maxAmount.
 */
export async function getReservedForAuction(userId: string, auctionId: string): Promise<number> {
  // Get user's highest bid on this auction
  const highestBid = await prisma.auctionBid.findFirst({
    where: { auctionId, bidderId: userId },
    orderBy: { amount: "desc" },
    select: { amount: true },
  });

  // Get user's active autobid on this auction
  const autoBid = await prisma.autoBid.findUnique({
    where: { userId_auctionId: { userId, auctionId } },
    select: { maxAmount: true, isActive: true },
  });

  const highestBidAmount = highestBid?.amount ?? 0;
  const autobidMax = autoBid?.isActive ? autoBid.maxAmount : 0;

  // Reserve 40% of whichever is higher
  const effectiveAmount = Math.max(highestBidAmount, autobidMax);
  return calculateReserveAmount(effectiveAmount);
}

/**
 * Recalculate total reserved balance from scratch for a user.
 * Sums up 40% of max(highestBid, autobidMax) per active auction.
 */
export async function recalculateTotalReserved(userId: string): Promise<number> {
  // Find all active auctions where this user has bids
  const activeBids = await prisma.auctionBid.findMany({
    where: {
      bidderId: userId,
      auction: { status: "ACTIVE" },
    },
    select: { auctionId: true, amount: true },
    orderBy: { amount: "desc" },
  });

  // Group by auction, keep highest bid per auction
  const highestPerAuction = new Map<string, number>();
  for (const bid of activeBids) {
    if (!highestPerAuction.has(bid.auctionId)) {
      highestPerAuction.set(bid.auctionId, bid.amount);
    }
  }

  // Get active autobids
  const activeAutoBids = await prisma.autoBid.findMany({
    where: {
      userId,
      isActive: true,
      auction: { status: "ACTIVE" },
    },
    select: { auctionId: true, maxAmount: true },
  });

  // Merge: for each auction, take max of highest bid and autobid max
  const auctionIds = new Set([...highestPerAuction.keys(), ...activeAutoBids.map(ab => ab.auctionId)]);
  let totalReserved = 0;

  for (const auctionId of auctionIds) {
    const highestBid = highestPerAuction.get(auctionId) ?? 0;
    const autobidMax = activeAutoBids.find(ab => ab.auctionId === auctionId)?.maxAmount ?? 0;
    totalReserved += calculateReserveAmount(Math.max(highestBid, autobidMax));
  }

  return Math.round(totalReserved * 100) / 100;
}

/**
 * Sync the user's reservedBalance field with the actual calculated value.
 * Use this as a safety check or after complex operations.
 */
export async function syncReservedBalance(userId: string): Promise<number> {
  const calculated = await recalculateTotalReserved(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { reservedBalance: calculated },
  });
  return calculated;
}
