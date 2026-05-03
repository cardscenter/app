import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { finalizeAuction } from "@/actions/auction";

// POST /api/auctions/[auctionId]/finalize
// Wordt aangeroepen door de live-auction-countdown zodra de timer 0 bereikt.
// finalizeAuction is idempotent (status-check + endTime-check), dus dubbele
// aanroepen door meerdere gelijktijdige viewers zijn safe — alleen de eerste
// doet werk, de rest is no-op.
//
// Geen auth-check: iedereen mag dit triggeren want het effect is enkel een
// status-flip die toch al ging gebeuren via de cron of page-view fallback.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ auctionId: string }> }
) {
  const { auctionId } = await params;

  // Quick gate: only act on auctions that exist and are still ACTIVE with
  // an expired endTime. Voorkomt onnodige finalizeAuction-calls vanuit
  // ratelimit-burst of pre-end clicks.
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { status: true, endTime: true },
  });
  if (!auction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (auction.status !== "ACTIVE") {
    return NextResponse.json({ status: "already_finalized" });
  }
  if (new Date() < auction.endTime) {
    return NextResponse.json({ status: "not_yet_ended" });
  }

  await finalizeAuction(auctionId);
  return NextResponse.json({ status: "finalized" });
}
