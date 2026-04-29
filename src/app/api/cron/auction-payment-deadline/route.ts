import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";
import { syncReservedBalance } from "@/lib/balance-check";
import { createPendingBundle } from "@/lib/shipping-bundle";

// GET /api/cron/auction-payment-deadline
// Call this daily to handle expired auction payment deadlines.
// Behaviour:
//   - If auction.runnerUpEnabled and runnerUpAttempts < seller.maxRunnerUpAttempts,
//     rotate the win to the next-highest bidder (not in failedBidderIds, not the
//     current winnerId). The new winner gets a fresh 5-day deadline.
//   - Otherwise, mark the auction as PAYMENT_FAILED and sync the reserve for
//     the (final) failed winner so their reservedBalance reflects reality.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processExpiredPaymentDeadlines();
  return NextResponse.json(result);
}

function parseFailedBidderIds(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function processExpiredPaymentDeadlines() {
  const now = new Date();

  const expiredAuctions = await prisma.auction.findMany({
    where: {
      paymentStatus: "AWAITING_PAYMENT",
      paymentDeadline: { lt: now },
    },
  });

  let processed = 0;
  let rotated = 0;

  for (const auction of expiredAuctions) {
    if (!auction.winnerId || !auction.finalPrice) continue;

    const seller = await prisma.user.findUnique({
      where: { id: auction.sellerId },
      select: { maxRunnerUpAttempts: true },
    });
    const maxAttempts = seller?.maxRunnerUpAttempts ?? 5;
    const failedBidderIds = parseFailedBidderIds(auction.failedBidderIds);
    const previousWinnerId = auction.winnerId;
    const previousWinnerTitle = auction.title;
    const previousWinnerPrice = auction.finalPrice;

    // Try runner-up rotation first
    let runnerUpBid: { bidderId: string; amount: number } | null = null;

    if (auction.runnerUpEnabled && auction.runnerUpAttempts < maxAttempts) {
      const excludedIds = new Set<string>([...failedBidderIds, previousWinnerId]);
      // Highest distinct-bidder bid that is not the current winner and not yet
      // marked failed. We can't use distinct() with comparison on amount, so
      // we order by amount desc and pick the first qualifying bidder.
      const candidates = await prisma.auctionBid.findMany({
        where: { auctionId: auction.id },
        orderBy: { amount: "desc" },
        select: { bidderId: true, amount: true },
      });

      for (const c of candidates) {
        if (!excludedIds.has(c.bidderId)) {
          runnerUpBid = c;
          break;
        }
      }
    }

    if (runnerUpBid) {
      const newDeadline = new Date();
      newDeadline.setDate(newDeadline.getDate() + 5);
      const newFailedBidders = [...failedBidderIds, previousWinnerId];

      await prisma.auction.update({
        where: { id: auction.id },
        data: {
          status: "ENDED_SOLD",
          paymentStatus: "AWAITING_PAYMENT",
          winnerId: runnerUpBid.bidderId,
          finalPrice: runnerUpBid.amount,
          paymentDeadline: newDeadline,
          failedBidderIds: JSON.stringify(newFailedBidders),
          runnerUpAttempts: { increment: 1 },
        },
      });

      // A2: previous winner's reserve must be released — their bid no longer
      // counts as winning. recalculateTotalReserved only counts ACTIVE auctions
      // and this auction stays ENDED_SOLD, so the old winner falls out of the
      // sum automatically — but we still call sync to be explicit.
      await syncReservedBalance(previousWinnerId);

      // D1: re-target the PENDING shipping bundle to the new winner. Delete
      // the old PENDING row (auctionId is @unique) and create a fresh one
      // with the new buyer's data. We do nothing with PAID bundles — those
      // shouldn't exist while paymentStatus is AWAITING_PAYMENT.
      const oldBundle = await prisma.shippingBundle.findUnique({
        where: { auctionId: auction.id },
      });
      if (oldBundle && oldBundle.status === "PENDING") {
        await prisma.shippingBundle.delete({ where: { id: oldBundle.id } });
      }
      const newWinner = await prisma.user.findUnique({
        where: { id: runnerUpBid.bidderId },
        select: { street: true, houseNumber: true, postalCode: true, city: true, country: true },
      });
      await createPendingBundle({
        buyerId: runnerUpBid.bidderId,
        sellerId: auction.sellerId,
        totalItemCost: runnerUpBid.amount,
        shippingCost: 0,
        auctionId: auction.id,
        address: newWinner ?? undefined,
      });

      // Notify the new winner — phrase honestly so they know they're a runner-up.
      await createNotification(
        runnerUpBid.bidderId,
        "AUCTION_WON",
        "Je bent de nieuwe winnaar",
        `De vorige bieder heeft niet betaald. Je hebt nu "${auction.title}" gewonnen voor €${runnerUpBid.amount.toFixed(2)}. Rond de betaling af binnen 5 dagen.`,
        `/nl/veilingen/${auction.id}`
      );

      // Notify the seller that the auction has rotated.
      await createNotification(
        auction.sellerId,
        "ITEM_SOLD",
        "Veiling doorgeschoven naar tweede bieder",
        `"${previousWinnerTitle}" is doorgeschoven naar de volgende bieder voor €${runnerUpBid.amount.toFixed(2)} (was €${previousWinnerPrice.toFixed(2)}).`,
        `/nl/veilingen/${auction.id}`
      );

      rotated++;
      processed++;
      continue;
    }

    // No runner-up available (disabled, exhausted, or no eligible bidder left)
    await prisma.auction.update({
      where: { id: auction.id },
      data: {
        status: "PAYMENT_FAILED",
        paymentStatus: "PAYMENT_FAILED",
      },
    });

    // A2: release the failed winner's reserve.
    await syncReservedBalance(previousWinnerId);

    // D1: drop the PENDING shipping bundle so it doesn't linger as a zombie
    // order in either party's dashboard. Only PENDING — never touch PAID.
    const failedBundle = await prisma.shippingBundle.findUnique({
      where: { auctionId: auction.id },
    });
    if (failedBundle && failedBundle.status === "PENDING") {
      await prisma.shippingBundle.delete({ where: { id: failedBundle.id } });
    }

    await createNotification(
      previousWinnerId,
      "AUCTION_WON",
      "Betaaltermijn verlopen",
      `De betaaltermijn voor "${previousWinnerTitle}" (€${previousWinnerPrice.toFixed(2)}) is verlopen.`,
      `/nl/veilingen/${auction.id}`
    );

    await createNotification(
      auction.sellerId,
      "ITEM_SOLD",
      "Betaling niet ontvangen",
      `De koper heeft "${previousWinnerTitle}" niet betaald binnen de termijn. De veiling is geannuleerd.`,
      `/nl/veilingen/${auction.id}`
    );

    processed++;
  }

  return { processed, rotated, total: expiredAuctions.length };
}
