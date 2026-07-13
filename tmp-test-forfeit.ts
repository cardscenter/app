import { prisma } from "./src/lib/prisma";
import { CRON_JOBS } from "./src/lib/cron-jobs";
import { calculateReserveForBid } from "./src/lib/balance-check";

async function main() {
  const seller = await prisma.user.findFirst({ where: { email: "pikachu@test.nl" }, select: { id: true } });
  const winner = await prisma.user.findFirst({ where: { email: "koper@test.nl" }, select: { id: true, balance: true } });
  if (!seller || !winner) throw new Error("seed users missing");

  console.log("Winner balance vooraf:", winner.balance.toFixed(2));
  const finalPrice = 100;
  console.log("Verwacht forfait (10% reserve):", calculateReserveForBid(finalPrice).toFixed(2));
  console.log("Verwachte fee (2,9%):", (Math.round(finalPrice * 0.029 * 100) / 100).toFixed(2));

  const auction = await prisma.auction.create({
    data: {
      title: "TMP-FORFEIT-TEST",
      auctionType: "SINGLE_CARD",
      sellerId: seller.id,
      startingBid: 50,
      duration: 3,
      endTime: new Date(Date.now() - 6 * 24 * 3600 * 1000),
      status: "ENDED_SOLD",
      paymentStatus: "AWAITING_PAYMENT",
      paymentDeadline: new Date(Date.now() - 24 * 3600 * 1000),
      winnerId: winner.id,
      finalPrice,
      currentBid: finalPrice,
      runnerUpEnabled: false,
    },
  });

  const result = await CRON_JOBS["auction-payment-deadline"]();
  console.log("\nCron-result:", JSON.stringify(result.result));

  const after = await prisma.user.findUnique({ where: { id: winner.id }, select: { balance: true, paymentFailureCount: true } });
  console.log("Winner balance na:", after!.balance.toFixed(2), "| strikes:", after!.paymentFailureCount);

  const txs = await prisma.transaction.findMany({
    where: { userId: winner.id, relatedAuctionId: auction.id },
    select: { type: true, amount: true, description: true },
  });
  console.log("Transacties:", JSON.stringify(txs, null, 2));

  const finalAuction = await prisma.auction.findUnique({
    where: { id: auction.id }, select: { status: true, paymentStatus: true },
  });
  console.log("Auction eindstatus:", JSON.stringify(finalAuction));

  // Cleanup: testdata terugdraaien zodat de seed-DB consistent blijft
  await prisma.transaction.deleteMany({ where: { relatedAuctionId: auction.id } });
  await prisma.auction.delete({ where: { id: auction.id } });
  const forfeit = calculateReserveForBid(finalPrice);
  const fee = Math.round(finalPrice * 0.029 * 100) / 100;
  await prisma.user.update({
    where: { id: winner.id },
    data: { balance: { increment: forfeit + fee }, paymentFailureCount: { decrement: 1 } },
  });
  const restored = await prisma.user.findUnique({ where: { id: winner.id }, select: { balance: true, paymentFailureCount: true } });
  console.log("\nCleanup klaar — balance hersteld:", restored!.balance.toFixed(2), "| strikes:", restored!.paymentFailureCount);
}

main().finally(() => prisma.$disconnect());
