import { prisma } from "@/lib/prisma";
import { getMinimumNextBid } from "@/lib/auction/bid-increments";
import { deductBalance, creditBalance } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";

/**
 * After a manual bid is placed, check if any other user has an active AutoBid
 * that can outbid the current highest bid. Resolves one autobid at a time
 * (the one with the highest maxAmount), then recurses if needed.
 *
 * Returns the final highest bid amount after all autobid resolutions.
 */
export async function resolveAutoBids(
  auctionId: string,
  currentBidAmount: number,
  currentBidderId: string
): Promise<{ finalBid: number; finalBidderId: string }> {
  // Find active autobids from OTHER users that can still outbid
  const nextBid = getMinimumNextBid(currentBidAmount);

  const autoBids = await prisma.autoBid.findMany({
    where: {
      auctionId,
      isActive: true,
      userId: { not: currentBidderId },
      maxAmount: { gte: nextBid },
    },
    orderBy: { maxAmount: "desc" },
  });

  if (autoBids.length === 0) {
    return { finalBid: currentBidAmount, finalBidderId: currentBidderId };
  }

  // Pick the autobidder with the highest max
  const winner = autoBids[0];

  // Determine the bid amount: just enough to outbid, but cap at maxAmount
  // If there's a second autobidder, bid just above their max
  let autobidAmount: number;
  if (autoBids.length >= 2) {
    const secondMax = autoBids[1].maxAmount;
    const justAboveSecond = getMinimumNextBid(secondMax);
    autobidAmount = Math.min(justAboveSecond, winner.maxAmount);
  } else {
    autobidAmount = nextBid;
  }

  // Ensure we don't exceed maxAmount
  if (autobidAmount > winner.maxAmount) {
    autobidAmount = winner.maxAmount;
  }

  // Ensure still meets minimum
  if (autobidAmount < nextBid) {
    return { finalBid: currentBidAmount, finalBidderId: currentBidderId };
  }

  // Check autobidder's balance
  const user = await prisma.user.findUnique({ where: { id: winner.userId } });
  if (!user || user.balance < autobidAmount) {
    // Deactivate this autobid — insufficient funds
    await prisma.autoBid.update({
      where: { id: winner.id },
      data: { isActive: false },
    });
    // Notify user their autobid failed
    await createNotification(
      winner.userId,
      "OUTBID",
      "Autobied gestopt",
      "Je autobied is gestopt wegens onvoldoende saldo.",
      `/nl/veilingen/${auctionId}`
    );
    // Try next autobidder
    return resolveAutoBids(auctionId, currentBidAmount, currentBidderId);
  }

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) {
    return { finalBid: currentBidAmount, finalBidderId: currentBidderId };
  }

  // Refund the previous highest bidder
  await creditBalance(
    currentBidderId,
    currentBidAmount,
    "AUCTION_BID_REFUND",
    `Bod teruggestort (autobied): ${auction.title}`,
    auctionId
  );

  // Deduct from autobidder
  await deductBalance(
    winner.userId,
    autobidAmount,
    "AUCTION_BID",
    `Autobied geplaatst: ${auction.title}`,
    auctionId
  );

  // Create the bid record
  await prisma.auctionBid.create({
    data: { auctionId, bidderId: winner.userId, amount: autobidAmount },
  });

  // Update auction currentBid
  await prisma.auction.update({
    where: { id: auctionId },
    data: { currentBid: autobidAmount },
  });

  // Notify the outbid user
  await createNotification(
    currentBidderId,
    "OUTBID",
    "Je bent overboden!",
    `Je bod van €${currentBidAmount.toFixed(2)} op "${auction.title}" is overboden door een autobied van €${autobidAmount.toFixed(2)}.`,
    `/nl/veilingen/${auctionId}`
  );

  // Deactivate autobid if maxAmount is reached (can't bid higher)
  const nextAfterThis = getMinimumNextBid(autobidAmount);
  if (winner.maxAmount < nextAfterThis) {
    await prisma.autoBid.update({
      where: { id: winner.id },
      data: { isActive: false },
    });
  }

  // Check if there are competing autobids that might outbid this one
  return resolveAutoBids(auctionId, autobidAmount, winner.userId);
}
