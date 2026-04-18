/**
 * Populate pricePriceChartingEur for all cards where priceAvg >= €250.
 * Forces pricing-stale on each card so enrichCard refetches the full
 * stack (CardMarket + PriceCharting) and blends them via getDisplayPrice.
 *
 * One-time-ish: after this runs, the daily cron will keep prices fresh
 * for cards that stay above the threshold.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { enrichCard } from "../src/lib/tcgdex/enrich-card";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const THRESHOLD = 250;
const DELAY_MS = 700;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const cards = await prisma.card.findMany({
    where: { priceAvg: { gte: THRESHOLD } },
    select: { id: true, name: true, priceAvg: true },
    orderBy: { priceAvg: "desc" },
  });

  console.log(`💎 Backfilling PriceCharting for ${cards.length} cards >= €${THRESHOLD}`);

  await prisma.card.updateMany({
    where: { id: { in: cards.map((c) => c.id) } },
    data: { priceUpdatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
  });

  let done = 0;
  let withPc = 0;
  let failed = 0;
  const start = Date.now();
  for (const c of cards) {
    try {
      const after = await enrichCard(c.id);
      if (after?.pricePriceChartingEur != null) {
        withPc++;
        console.log(`  ✓ ${c.id} ${c.name.padEnd(30)} avg=€${after.priceAvg?.toFixed(0)} pc=€${after.pricePriceChartingEur.toFixed(0)}`);
      } else {
        console.log(`  · ${c.id} ${c.name.padEnd(30)} avg=€${after?.priceAvg?.toFixed(0)} (no PC match)`);
      }
      done++;
    } catch (e) {
      failed++;
      console.warn(`  ! ${c.id}: ${e instanceof Error ? e.message : e}`);
    }
    if (done % 25 === 0) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`  ... ${done}/${cards.length} processed (${elapsed}s, ${withPc} with PC data)`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done. ${done} processed, ${withPc} with PriceCharting data, ${failed} failed.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
