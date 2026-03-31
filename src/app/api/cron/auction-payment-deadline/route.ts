import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";

// GET /api/cron/auction-payment-deadline
// Call this daily to handle expired auction payment deadlines
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processExpiredPaymentDeadlines();
  return NextResponse.json(result);
}

async function processExpiredPaymentDeadlines() {
  const now = new Date();

  // Find all auctions with expired payment deadlines
  const expiredAuctions = await prisma.auction.findMany({
    where: {
      paymentStatus: "AWAITING_PAYMENT",
      paymentDeadline: { lt: now },
    },
  });

  let processed = 0;

  for (const auction of expiredAuctions) {
    if (!auction.winnerId || !auction.finalPrice) continue;

    // Mark as payment failed
    await prisma.auction.update({
      where: { id: auction.id },
      data: {
        status: "PAYMENT_FAILED",
        paymentStatus: "PAYMENT_FAILED",
      },
    });

    // Notify both parties
    await createNotification(
      auction.winnerId,
      "AUCTION_WON",
      "Betaaltermijn verlopen",
      `De betaaltermijn voor "${auction.title}" (€${auction.finalPrice.toFixed(2)}) is verlopen.`,
      `/nl/veilingen/${auction.id}`
    );

    await createNotification(
      auction.sellerId,
      "ITEM_SOLD",
      "Betaling niet ontvangen",
      `De koper heeft "${auction.title}" niet betaald binnen de termijn. De veiling is geannuleerd.`,
      `/nl/veilingen/${auction.id}`
    );

    processed++;
  }

  return { processed, total: expiredAuctions.length };
}
