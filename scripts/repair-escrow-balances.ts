/**
 * Repair-script: corrigeert seller.heldBalance naar de werkelijke som van
 * actieve PAID/SHIPPED bundles (totalCost − refundedAmount).
 *
 * Use-case: na een data-mismatch (bv. testdata-seeder die bundles aanmaakte
 * zonder escrow te boeken, of een legacy releaseEscrow die heldBalance
 * negatief liet zakken) loopt heldBalance uit de pas met de werkelijke
 * verplichting.
 *
 * Voor productie eerst dry-run, daarna `--apply`. Dit script is alleen voor
 * dev-omgeving / test-data — in productie zou je een eenmalige migratie
 * draaien met expliciete tegenboeking-Transaction-rijen voor audit.
 *
 * Run: `npx tsx scripts/repair-escrow-balances.ts`           (dry-run)
 *      `npx tsx scripts/repair-escrow-balances.ts --apply`   (echt fixen)
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "🔧 REPAIR MODE — schrijft wijzigingen weg\n" : "👀 DRY-RUN — geen wijzigingen, alleen rapport\n");

  // Verzamel alle sellers met actieve bundles
  const activeBundles = await prisma.shippingBundle.findMany({
    where: { status: { in: ["PAID", "SHIPPED"] } },
    select: { sellerId: true, totalCost: true, refundedAmount: true },
  });

  const expectedHeldBySeller = new Map<string, number>();
  for (const b of activeBundles) {
    const delta = b.totalCost - b.refundedAmount;
    expectedHeldBySeller.set(b.sellerId, (expectedHeldBySeller.get(b.sellerId) ?? 0) + delta);
  }

  // Plus: alle users met heldBalance ≠ 0 die mogelijk geen actieve bundles meer
  // hebben (anomalie — heldBalance moet dan 0 worden)
  const usersWithHeld = await prisma.user.findMany({
    where: { heldBalance: { not: 0 } },
    select: { id: true, displayName: true, email: true, heldBalance: true },
  });

  const allUserIds = new Set([
    ...expectedHeldBySeller.keys(),
    ...usersWithHeld.map((u) => u.id),
  ]);

  let mismatchCount = 0;
  let totalAdjustment = 0;

  for (const userId of allUserIds) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true, heldBalance: true },
    });
    if (!user) continue;

    const expected = Math.round((expectedHeldBySeller.get(userId) ?? 0) * 100) / 100;
    const actual = Math.round(user.heldBalance * 100) / 100;
    const delta = Math.round((expected - actual) * 100) / 100;

    if (Math.abs(delta) < 0.01) continue;

    mismatchCount++;
    totalAdjustment += delta;

    console.log(
      `${user.displayName.padEnd(20)} ${user.email.padEnd(28)} held: €${actual.toFixed(2).padStart(10)} → €${expected.toFixed(2).padStart(10)}  (Δ €${delta >= 0 ? "+" : ""}${delta.toFixed(2)})`,
    );

    if (APPLY) {
      await prisma.user.update({
        where: { id: userId },
        data: { heldBalance: expected },
      });
    }
  }

  console.log(`\n${mismatchCount} users met mismatched heldBalance.`);
  console.log(`Totale correctie: €${totalAdjustment >= 0 ? "+" : ""}${totalAdjustment.toFixed(2)}`);
  if (!APPLY) console.log(`\nRun met --apply om de correcties weg te schrijven.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
