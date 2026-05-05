/**
 * Diepe escrow-audit voor 27 Buyer.
 *
 * Vraag: hoe komt heldBalance tot stand, klopt de optelling met de actieve
 * bundles, en waar komt elke euro vandaan?
 *
 * Per bundle:
 *  - Status, datum, ordernummer
 *  - totalItemCost vs som-van-items (consistency-check)
 *  - shippingCost
 *  - refundedAmount + per-item refunds
 *  - escrow-bijdrage = totalCost − refundedAmount
 *  - Bron-Transaction-records (ESCROW_HOLD) als die er zijn
 *
 * Eind: optelling vs heldBalance.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

function fmt(n: number): string {
  return `€${n.toFixed(2).padStart(9)}`;
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "buyer@fase27.test" },
    select: { id: true, displayName: true, balance: true, heldBalance: true, reservedBalance: true },
  });
  if (!user) throw new Error("27 Buyer niet gevonden");

  console.log("════════════════════════════════════════════════════════════════════");
  console.log(`ESCROW-AUDIT — ${user.displayName}`);
  console.log("════════════════════════════════════════════════════════════════════");
  console.log(`balance:         ${fmt(user.balance)}`);
  console.log(`heldBalance:     ${fmt(user.heldBalance)}   ← actief in escrow`);
  console.log(`reservedBalance: ${fmt(user.reservedBalance)}   ← 40%-reserves voor auction-bids`);
  console.log(`available:       ${fmt(user.balance - user.reservedBalance)}   ← te besteden / uit te betalen`);
  console.log("");

  // ── 1. Actieve bundles waar 27 Buyer SELLER is ─────────────────────────
  const sellerBundles = await prisma.shippingBundle.findMany({
    where: { sellerId: user.id, status: { in: ["PAID", "SHIPPED"] } },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        select: { id: true, cardName: true, price: true, refundedAt: true },
      },
      buyer: { select: { displayName: true } },
    },
  });

  console.log(`────────────────────────────────────────────────────────────────────`);
  console.log(`ACTIEVE BUNDLES als VERKOPER  (status = PAID of SHIPPED)`);
  console.log(`────────────────────────────────────────────────────────────────────`);

  let totalEscrowExpected = 0;
  let totalCostSum = 0;
  let totalRefundedSum = 0;

  for (const b of sellerBundles) {
    const itemsSum = Math.round(b.items.reduce((s, i) => s + i.price, 0) * 100) / 100;
    const itemConsistency = Math.abs(itemsSum - b.totalItemCost) < 0.01;
    const totalConsistency = Math.abs(b.totalItemCost + b.shippingCost - b.totalCost) < 0.01;
    const escrowDelta = Math.round((b.totalCost - b.refundedAmount) * 100) / 100;
    const refundedItemCount = b.items.filter((i) => i.refundedAt).length;

    totalEscrowExpected += escrowDelta;
    totalCostSum += b.totalCost;
    totalRefundedSum += b.refundedAmount;

    console.log(`\n• ${b.orderNumber}  ${b.status.padEnd(8)}  buyer: ${b.buyer.displayName}`);
    console.log(`    aangemaakt:        ${b.createdAt.toISOString().slice(0, 16)}`);
    console.log(`    items:             ${b.items.length}× — sum-of-prices ${fmt(itemsSum)}`);
    console.log(`    totalItemCost:     ${fmt(b.totalItemCost)} ${itemConsistency ? "✓" : "✗ MISMATCH met items"}`);
    console.log(`    shippingCost:      ${fmt(b.shippingCost)}`);
    console.log(`    totalCost:         ${fmt(b.totalCost)} ${totalConsistency ? "✓" : "✗ MISMATCH (items+ship≠total)"}`);
    if (b.refundedAmount > 0) {
      console.log(`    refundedAmount:    ${fmt(b.refundedAmount)}  (${refundedItemCount} items met refundedAt)`);
    }
    console.log(`    → escrow-bijdrage: ${fmt(escrowDelta)}  (totalCost − refundedAmount)`);
  }

  console.log("");
  console.log(`────────────────────────────────────────────────────────────────────`);
  console.log(`OPTELLING`);
  console.log(`────────────────────────────────────────────────────────────────────`);
  console.log(`Som totalCost:        ${fmt(totalCostSum)}`);
  console.log(`Som refundedAmount:   ${fmt(totalRefundedSum)}`);
  console.log(`────`);
  console.log(`Verwacht heldBalance: ${fmt(totalEscrowExpected)}  (som van escrow-bijdragen)`);
  console.log(`Werkelijk heldBalance:${fmt(user.heldBalance)}`);
  const delta = Math.round((user.heldBalance - totalEscrowExpected) * 100) / 100;
  console.log(`Delta:                ${fmt(delta)}  ${Math.abs(delta) < 0.01 ? "✓ KLOPT" : "✗ MISMATCH"}`);
  console.log("");

  // ── 2. Transaction-records die ESCROW_HOLD doen voor deze user ─────────
  const escrowTxs = await prisma.transaction.findMany({
    where: { userId: user.id, type: "ESCROW_HOLD" },
    orderBy: { createdAt: "asc" },
    select: { id: true, amount: true, createdAt: true, description: true, relatedShippingBundleId: true },
  });

  console.log(`────────────────────────────────────────────────────────────────────`);
  console.log(`TRANSACTION-LOG — bron-events voor heldBalance`);
  console.log(`────────────────────────────────────────────────────────────────────`);
  if (escrowTxs.length === 0) {
    console.log(`⚠️  GEEN ESCROW_HOLD-Transactions voor deze user.`);
    console.log(`   Dit is ongebruikelijk: in normale checkout-flow zou er per item`);
    console.log(`   een ESCROW_HOLD-rij staan. Het ontbreken wijst op testdata die`);
    console.log(`   direct de heldBalance heeft gemuteerd (seeder-script of repair),`);
    console.log(`   zonder via escrowCredit() te lopen.`);
  } else {
    let escrowTxSum = 0;
    for (const tx of escrowTxs) {
      escrowTxSum += tx.amount;
      console.log(`  ${tx.createdAt.toISOString().slice(0, 16)}  +${fmt(tx.amount)}  ${tx.description.slice(0, 60)}`);
    }
    console.log(`  ────`);
    console.log(`  Som ESCROW_HOLD:    ${fmt(escrowTxSum)}`);
  }
  console.log("");

  // ── 3. Refund-events die heldBalance verlagen ──────────────────────────
  const refundTxs = await prisma.transaction.findMany({
    where: {
      relatedShippingBundleId: { in: sellerBundles.map((b) => b.id) },
      OR: [
        { description: { startsWith: "Gedeeltelijke terugbetaling" } },
        { description: { startsWith: "Terugbetaling:" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { amount: true, createdAt: true, description: true, userId: true },
  });

  console.log(`────────────────────────────────────────────────────────────────────`);
  console.log(`REFUND-EVENTS — verlagen heldBalance`);
  console.log(`────────────────────────────────────────────────────────────────────`);
  if (refundTxs.length === 0) {
    console.log(`  Geen refund-Transactions op deze bundles.`);
  } else {
    for (const tx of refundTxs) {
      console.log(`  ${tx.createdAt.toISOString().slice(0, 16)}  -${fmt(tx.amount)}  ${tx.description.slice(0, 60)}`);
    }
  }
  console.log("");

  // ── 4. Conclusie ───────────────────────────────────────────────────────
  console.log(`────────────────────────────────────────────────────────────────────`);
  console.log(`CONCLUSIE`);
  console.log(`────────────────────────────────────────────────────────────────────`);
  if (Math.abs(delta) < 0.01) {
    console.log(`✓ heldBalance €${user.heldBalance.toFixed(2)} klopt met de som van actieve bundles.`);
  } else {
    console.log(`✗ heldBalance €${user.heldBalance.toFixed(2)} wijkt af van bundle-som €${totalEscrowExpected.toFixed(2)}.`);
  }
  if (escrowTxs.length === 0) {
    console.log(``);
    console.log(`⚠️  De heldBalance is opgebouwd door direct DB-mutatie (testdata-seeder),`);
    console.log(`   niet via de productie-escrowCredit-flow. Voor productie-data zou`);
    console.log(`   elke bundle een ESCROW_HOLD-Transaction-rij hebben — voor audit.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
