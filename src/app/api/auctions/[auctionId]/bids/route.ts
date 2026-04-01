import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ auctionId: string }> }
) {
  const { auctionId } = await params;

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: {
      currentBid: true,
      startingBid: true,
      buyNowPrice: true,
      endTime: true,
      status: true,
      bids: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          bidderId: true,
          bidder: { select: { displayName: true } },
        },
      },
      _count: { select: { bids: true } },
    },
  });

  if (!auction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const highestBidderId = auction.bids[0]?.bidderId ?? null;

  return NextResponse.json({
    currentBid: auction.currentBid,
    startingBid: auction.startingBid,
    buyNowPrice: auction.buyNowPrice,
    endTime: auction.endTime,
    status: auction.status,
    bidCount: auction._count.bids,
    highestBidderId,
    recentBids: auction.bids.map((b) => ({
      id: b.id,
      amount: b.amount,
      bidderName: b.bidder.displayName,
      createdAt: b.createdAt,
    })),
  });
}
