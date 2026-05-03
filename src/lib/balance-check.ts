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
 * Mirrort de logica van recalculateTotalReserved voor één auction:
 * - ACTIVE + user is hoogste bieder: 40% × max(userBid, autobidMax)
 * - ACTIVE + user is overboden maar heeft active autobid: 40% × autobidMax
 * - AWAITING_PAYMENT + user is winner: 40% × finalPrice
 * - Anders: 0
 */
export async function getReservedForAuction(userId: string, auctionId: string): Promise<number> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: {
      status: true,
      paymentStatus: true,
      winnerId: true,
      finalPrice: true,
      bids: { orderBy: { amount: "desc" }, take: 1, select: { bidderId: true } },
    },
  });
  if (!auction) return 0;

  // AWAITING_PAYMENT-pad
  if (auction.paymentStatus === "AWAITING_PAYMENT" && auction.winnerId === userId) {
    return calculateReserveAmount(auction.finalPrice ?? 0);
  }
  if (auction.status !== "ACTIVE") return 0;

  // User's highest bid + autobid op deze auction
  const highestBid = await prisma.auctionBid.findFirst({
    where: { auctionId, bidderId: userId },
    orderBy: { amount: "desc" },
    select: { amount: true },
  });
  const autoBid = await prisma.autoBid.findUnique({
    where: { userId_auctionId: { userId, auctionId } },
    select: { maxAmount: true, isActive: true },
  });

  const userBidAmount = highestBid?.amount ?? 0;
  const autobidMax = autoBid?.isActive ? autoBid.maxAmount : 0;
  const isHighestBidder = auction.bids[0]?.bidderId === userId;

  if (isHighestBidder) {
    return calculateReserveAmount(Math.max(userBidAmount, autobidMax));
  }
  if (autobidMax > 0) {
    return calculateReserveAmount(autobidMax);
  }
  return 0;
}

/**
 * Recalculate total reserved balance from scratch for a user.
 *
 * Wat reserveert:
 * 1. ACTIVE auctions waar user de **huidige hoogste bieder** is — 40% van
 *    max(user's highest bid, user's autobid max).
 * 2. ACTIVE auctions waar user is overboden maar een **actieve autobid** heeft —
 *    40% van autobid max (kan elk moment getriggerd worden door een nieuwe
 *    bid, dus commitment moet vastgehouden worden).
 * 3. AWAITING_PAYMENT auctions waar user de **winner** is — 40% van finalPrice
 *    (commitment tot completeAuctionPayment of cron-driven PAYMENT_FAILED).
 *
 * Wat NIET reserveert (bug-fix Fase 27.98):
 * - Overboden bids zonder autobid — geld is vrij. Voorheen werden deze
 *   ten onrechte als reserve gerekend, waardoor users geld bevroren zagen
 *   na een outbid (bv. 27 buyer met €103.21 stale reserve).
 * - PAID auctions of CANCELLED/PAYMENT_FAILED — afgehandeld of geen
 *   commitment meer.
 */
export async function recalculateTotalReserved(userId: string): Promise<number> {
  // Eligible auctions: ACTIVE waar user heeft geboden, of AWAITING_PAYMENT
  // waar user de winner is. Pak top-bid mee om "is hoogste bieder?"-check
  // te doen zonder extra round-trip.
  const eligible = await prisma.auction.findMany({
    where: {
      OR: [
        { status: "ACTIVE", bids: { some: { bidderId: userId } } },
        { paymentStatus: "AWAITING_PAYMENT", winnerId: userId },
      ],
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      winnerId: true,
      finalPrice: true,
      bids: {
        orderBy: { amount: "desc" },
        take: 1,
        select: { bidderId: true },
      },
    },
  });

  if (eligible.length === 0) return 0;

  const auctionIds = eligible.map((a) => a.id);

  // User's eigen highest bid per auction (voor reserve-berekening)
  const userBids = await prisma.auctionBid.findMany({
    where: { bidderId: userId, auctionId: { in: auctionIds } },
    orderBy: { amount: "desc" },
    select: { auctionId: true, amount: true },
  });
  const userHighestBidByAuction = new Map<string, number>();
  for (const b of userBids) {
    if (!userHighestBidByAuction.has(b.auctionId)) {
      userHighestBidByAuction.set(b.auctionId, b.amount);
    }
  }

  // User's actieve autobids op deze auctions
  const activeAutoBids = await prisma.autoBid.findMany({
    where: { userId, isActive: true, auctionId: { in: auctionIds } },
    select: { auctionId: true, maxAmount: true },
  });
  const autoMaxByAuction = new Map<string, number>();
  for (const ab of activeAutoBids) autoMaxByAuction.set(ab.auctionId, ab.maxAmount);

  let totalReserved = 0;
  for (const a of eligible) {
    // AWAITING_PAYMENT-pad: winner reserveert 40% van finalPrice
    if (a.paymentStatus === "AWAITING_PAYMENT" && a.winnerId === userId) {
      totalReserved += calculateReserveAmount(a.finalPrice ?? 0);
      continue;
    }

    // ACTIVE-pad: alleen als user huidige hoogste bieder is, OF autobid actief
    const isHighestBidder = a.bids[0]?.bidderId === userId;
    const userBid = userHighestBidByAuction.get(a.id) ?? 0;
    const autoMax = autoMaxByAuction.get(a.id) ?? 0;

    if (isHighestBidder) {
      totalReserved += calculateReserveAmount(Math.max(userBid, autoMax));
    } else if (autoMax > 0) {
      // Overboden maar autobid kan triggeren → reserve max-amount
      totalReserved += calculateReserveAmount(autoMax);
    }
    // Anders: niets — overboden zonder autobid = geld vrij
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
