/**
 * Refresh pricing for all cards in sets where TCGdex's CardMarket mapping
 * is broken (multiple cards sharing one idProduct, or pinned to wrong
 * products). After the fix in pricing.ts, re-enriching these cards makes
 * them fall back to pokemontcg.io for accurate per-card prices.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { enrichCard } from "../src/lib/tcgdex/enrich-card";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const UNRELIABLE_SETS = ["sv03.5", "sv08.5", "sv10.5b", "sv10.5w", "me02.5"];
const DELAY_MS = 600; // pokemontcg.io is rate-limited but generous

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const sets = await prisma.cardSet.findMany({
    where: { tcgdexSetId: { in: UNRELIABLE_SETS } },
    select: { id: true, name: true, tcgdexSetId: true },
  });

  console.log(`📦 Refreshing pricing in ${sets.length} sets: ${sets.map((s) => s.tcgdexSetId).join(", ")}`);

  let totalDone = 0;
  let totalFailed = 0;

  for (const set of sets) {
    const cards = await prisma.card.findMany({
      where: { cardSetId: set.id },
      select: { id: true, name: true, localId: true },
      orderBy: { localId: "asc" },
    });
    console.log(`\n[${set.tcgdexSetId}] ${set.name} — ${cards.length} cards`);

    // Force pricing-stale so enrichCard re-fetches from the now-preferred source
    await prisma.card.updateMany({
      where: { id: { in: cards.map((c) => c.id) } },
      data: { priceUpdatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    let done = 0;
    let failed = 0;
    const start = Date.now();
    for (const c of cards) {
      try {
        await enrichCard(c.id);
        done++;
        if (done % 25 === 0) {
          const elapsed = Math.round((Date.now() - start) / 1000);
          console.log(`  ... ${done}/${cards.length} (${elapsed}s)`);
        }
      } catch (e) {
        failed++;
        console.warn(`  ! ${c.id}: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(DELAY_MS);
    }
    console.log(`  [${set.tcgdexSetId}] done: ${done} refreshed, ${failed} failed`);
    totalDone += done;
    totalFailed += failed;
  }

  console.log(`\n✅ Total: ${totalDone} refreshed, ${totalFailed} failed`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
