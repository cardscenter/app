import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const buyer = await prisma.user.findUnique({
    where: { email: "buyer@fase27.test" },
    select: { id: true, displayName: true, balance: true, heldBalance: true, reservedBalance: true },
  });
  const seller = await prisma.user.findUnique({
    where: { email: "seller@fase27.test" },
    select: { id: true, displayName: true, balance: true, heldBalance: true, reservedBalance: true },
  });
  const buyer2 = await prisma.user.findUnique({
    where: { email: "buyer2@fase27.test" },
    select: { id: true, displayName: true, balance: true, heldBalance: true, reservedBalance: true },
  });
  if (!buyer || !seller || !buyer2) throw new Error("test users not found");

  console.log("\n=== USER WALLETS ===");
  for (const u of [buyer, seller, buyer2]) {
    console.log(`${u.displayName.padEnd(15)} | balance: €${u.balance.toFixed(2).padStart(10)} | held: €${u.heldBalance.toFixed(2).padStart(10)} | reserved: €${u.reservedBalance.toFixed(2).padStart(10)}`);
  }

  // Som van bundle.totalCost waar de user seller is en bundle PAID/SHIPPED is
  for (const u of [buyer, seller, buyer2]) {
    const bundles = await prisma.shippingBundle.findMany({
      where: { sellerId: u.id, status: { in: ["PAID", "SHIPPED"] } },
      select: { id: true, status: true, totalCost: true, totalItemCost: true, refundedAmount: true, orderNumber: true, createdAt: true },
    });
    const totalCostSum = bundles.reduce((s, b) => s + (b.totalCost - b.refundedAmount), 0);
    const itemCostSum = bundles.reduce((s, b) => s + (b.totalItemCost - b.refundedAmount), 0);
    console.log(`\n${u.displayName} as seller — ${bundles.length} active bundles, expected escrow:`);
    console.log(`  sum(totalCost - refunded) = €${totalCostSum.toFixed(2)}  (Fase-28 model)`);
    console.log(`  sum(totalItemCost - refunded) = €${itemCostSum.toFixed(2)}  (pre-Fase-28 model)`);
    console.log(`  actual heldBalance = €${u.heldBalance.toFixed(2)}`);
    console.log(`  delta vs Fase-28 expected: €${(u.heldBalance - totalCostSum).toFixed(2)}`);
  }

  // Recent transactions for 27 Buyer
  console.log("\n=== Recent transactions for 27Buyer ===");
  const txs = await prisma.transaction.findMany({
    where: { userId: buyer.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { type: true, amount: true, balanceBefore: true, balanceAfter: true, description: true, createdAt: true },
  });
  for (const tx of txs) {
    console.log(`${tx.createdAt.toISOString().slice(0, 16)} ${tx.type.padEnd(20)} €${tx.amount.toFixed(2).padStart(10)} | bal ${tx.balanceBefore.toFixed(2)}→${tx.balanceAfter.toFixed(2)} | ${tx.description.slice(0, 60)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
