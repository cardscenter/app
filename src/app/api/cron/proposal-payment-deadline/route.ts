import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";

// GET /api/cron/proposal-payment-deadline
// Mirrors auction-payment-deadline but for chat proposals: when an ACCEPTED
// proposal with a 5-day payment window expires, mark it PAYMENT_FAILED, free
// the linked listing back to ACTIVE (clearing buyerId), and notify both
// parties. Proposals have no bid order, so no runner-up rotation — the
// listing is just released back into the marketplace.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processExpiredProposalDeadlines();
  return NextResponse.json(result);
}

async function processExpiredProposalDeadlines() {
  const now = new Date();

  const expiredProposals = await prisma.proposal.findMany({
    where: {
      status: "ACCEPTED",
      paymentStatus: "AWAITING_PAYMENT",
      paymentDeadline: { lt: now },
    },
    include: {
      listing: { select: { id: true, title: true, sellerId: true } },
      conversation: { include: { participants: true } },
    },
  });

  let processed = 0;

  for (const proposal of expiredProposals) {
    // Buyer is the proposer for BUY proposals, the other participant for SELL
    const buyerId =
      proposal.type === "BUY"
        ? proposal.proposerId
        : proposal.conversation.participants.find((p) => p.userId !== proposal.proposerId)?.userId;
    const sellerId =
      proposal.listing?.sellerId ??
      proposal.conversation.participants.find((p) => p.userId !== buyerId)?.userId;

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { paymentStatus: "PAYMENT_FAILED" },
    });

    if (proposal.listing) {
      // Mirror the inline fix in completeProposalPayment: free the listing
      // back to ACTIVE so the seller can re-list or accept new proposals.
      await prisma.listing.update({
        where: { id: proposal.listing.id },
        data: { status: "ACTIVE", buyerId: null },
      });
    }

    const contextTitle = proposal.listing?.title ?? "betaalverzoek";
    const amountStr = proposal.amount.toFixed(2);

    if (buyerId) {
      await createNotification(
        buyerId,
        "NEW_MESSAGE",
        "Betaaltermijn verlopen",
        `De betaaltermijn voor het voorstel "${contextTitle}" (€${amountStr}) is verlopen.`,
        `/nl/berichten/${proposal.conversationId}`
      );
    }

    if (sellerId) {
      await createNotification(
        sellerId,
        "NEW_MESSAGE",
        "Betaaltermijn verlopen",
        `De koper heeft het voorstel voor "${contextTitle}" (€${amountStr}) niet betaald binnen de termijn.`,
        `/nl/berichten/${proposal.conversationId}`
      );
    }

    processed++;
  }

  return { processed, total: expiredProposals.length };
}
