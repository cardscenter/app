/**
 * Diepe reservedBalance-audit voor 27 Buyer (Fase 30A debug).
 *
 * Reproduceert exact de logica van recalculateTotalReserved in
 * src/lib/balance-check.ts en print elke bron afzonderlijk:
 *  - ACTIVE auctions waar user hoogste bieder is
 *  - ACTIVE auctions waar user is overboden maar autobid actief heeft
 *  - AWAITING_PAYMENT auctions waar user winner is
 *  - ACTIVE autobids zonder bid-record (zou GEEN reserve moeten geven, maar
 *    we tonen ze ter info zodat we afwijkingen kunnen spotten)
 *
 * Eind: vergelijking met User.reservedBalance.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { getMinimumNextBid } from "../src/lib/auction/bid-increments";

const RESERVE_RATE = 0.10;

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

function fmt(n: number): string {
  return `€${n.toFixed(2).padStart(9)}`;
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "buyer@fase27.test" },
    select: { id: true, displayName: true, balance: true, reservedBalance: true },
  });
  if (!user) throw new Error("27 Buyer niet gevonden");

  console.log("════════════════════════════════════════════════════════════════════");
  console.log(`RESERVED-AUDIT — ${user.displayName}`);
  console.log("════════════════════════════════════════════════════════════════════");
  console.log(`balance:         ${fmt(user.balance)}`);
  console.log(`reservedBalance: ${fmt(user.reservedBalance)}`);
  console.log(`available:       ${fmt(user.balance - user.reservedBalance)}`);
  console.log("");

  // Alle auctions waar de user op enig moment heeft geboden of de winner is.
  const allAuctions = await prisma.auction.findMany({
    where: {
      OR: [
        { bids: { some: { bidderId: user.id } } },
        { winnerId: user.id },
        { autoBids: { some: { userId: user.id } } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      paymentStatus: true,
      currentBid: true,
      finalPrice: true,
      winnerId: true,
      bids: { orderBy: { amount: "desc" }, take: 1, select: { bidderId: true, amount: true } },
    },
  });

  console.log(`Totaal aantal auctions met activiteit: ${allAuctions.length}`);
  console.log("");

  let computedReserve = 0;

  console.log(`────────────────────────────────────────────────────────────────────`);
  console.log(`PER AUCTION:`);
  console.log(`────────────────────────────────────────────────────────────────────`);

  for (const a of allAuctions) {
    const userBid = await prisma.auctionBid.findFirst({
      where: { auctionId: a.id, bidderId: user.id },
      orderBy: { amount: "desc" },
      select: { amount: true },
    });
    const autoBid = await prisma.autoBid.findUnique({
      where: { userId_auctionId: { userId: user.id, auctionId: a.id } },
      select: { maxAmount: true, isActive: true },
    });

    const isHighest = a.bids[0]?.bidderId === user.id;
    const userBidAmount = userBid?.amount ?? 0;
    const autoMax = autoBid?.isActive ? autoBid.maxAmount : 0;

    let reserveContrib = 0;
    let reason = "GEEN reserve";

    // Stale-autobid check (Fase 30A): als de huidige bid al boven de
    // autobid-max staat, kan de autobid nooit meer triggeren — geen reserve.
    const topAmount = a.bids[0]?.amount ?? a.currentBid ?? 0;
    const minNextBid = getMinimumNextBid(topAmount);
    const autoCanTrigger = autoMax >= minNextBid;
    const effectiveAutoMax = autoCanTrigger ? autoMax : 0;

    if (a.paymentStatus === "AWAITING_PAYMENT" && a.winnerId === user.id) {
      reserveContrib = Math.round((a.finalPrice ?? 0) * RESERVE_RATE * 100) / 100;
      reason = `AWAITING_PAYMENT winner — 10% van finalPrice €${(a.finalPrice ?? 0).toFixed(2)}`;
    } else if (a.status === "ACTIVE" && isHighest) {
      const base = Math.max(userBidAmount, effectiveAutoMax);
      reserveContrib = Math.round(base * RESERVE_RATE * 100) / 100;
      reason = `ACTIVE hoogste bieder — 10% van max(bid €${userBidAmount.toFixed(2)}, autobid €${effectiveAutoMax.toFixed(2)}) = 10% × €${base.toFixed(2)}`;
    } else if (a.status === "ACTIVE" && autoCanTrigger) {
      reserveContrib = Math.round(autoMax * RESERVE_RATE * 100) / 100;
      reason = `ACTIVE overboden + autobid actief & kan triggeren — 10% van autobid-max €${autoMax.toFixed(2)}`;
    } else if (a.status === "ACTIVE" && autoMax > 0 && !autoCanTrigger) {
      reason = `ACTIVE — autobid actief maar STALE (max €${autoMax.toFixed(2)} < min next bid €${minNextBid.toFixed(2)}, geen reserve)`;
    } else if (a.status === "ACTIVE" && autoBid && !autoBid.isActive) {
      reason = `ACTIVE — autobid bestaat maar is INACTIVE (geen reserve)`;
    } else if (a.status === "ACTIVE") {
      reason = `ACTIVE — overboden zonder autobid (geen reserve)`;
    } else {
      reason = `${a.status} / ${a.paymentStatus} — geen reserve op deze status`;
    }

    computedReserve += reserveContrib;

    console.log(`\n• ${a.title.slice(0, 50)}`);
    console.log(`    id:               ${a.id}`);
    console.log(`    status:           ${a.status} / paymentStatus=${a.paymentStatus}`);
    console.log(`    currentBid:       €${(a.currentBid ?? 0).toFixed(2)}`);
    console.log(`    finalPrice:       €${(a.finalPrice ?? 0).toFixed(2)}`);
    console.log(`    user's hoogste bid: €${userBidAmount.toFixed(2)} ${isHighest ? "(IS hoogste bieder)" : "(overboden)"}`);
    console.log(`    autoBid:          ${autoBid ? `max €${autoBid.maxAmount.toFixed(2)} (${autoBid.isActive ? "ACTIVE" : "INACTIVE"})` : "geen"}`);
    console.log(`    reasoning:        ${reason}`);
    console.log(`    → bijdrage:       ${fmt(reserveContrib)}`);
  }

  console.log("");
  console.log(`────────────────────────────────────────────────────────────────────`);
  console.log(`OPTELLING`);
  console.log(`────────────────────────────────────────────────────────────────────`);
  console.log(`Berekend reserve:  ${fmt(computedReserve)}`);
  console.log(`Werkelijk reserve: ${fmt(user.reservedBalance)}`);
  const delta = Math.round((user.reservedBalance - computedReserve) * 100) / 100;
  console.log(`Delta:             ${fmt(delta)}  ${Math.abs(delta) < 0.01 ? "✓ KLOPT" : "✗ MISMATCH — stale reservedBalance"}`);

  if (Math.abs(delta) > 0.01) {
    console.log("");
    console.log(`💡 Run syncReservedBalance(userId) om reservedBalance te corrigeren.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
