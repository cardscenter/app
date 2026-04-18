/**
 * Refresh pricing for all cards in sets where TCGdex's CardMarket mapping
 * is broken (multiple cards sharing one idProduct, or pinned to wrong
 * products). After the fix in pricing.ts, re-enriching these cards makes
 * them fall back to pokemontcg.io for accurate per-card prices.
 *
 * Processes each set with a fresh Prisma client to avoid long-running
 * connections timing out on slower PokéAPI / pokemontcg.io requests.
 *
 * Usage: npx tsx prisma/refresh-unreliable-sets.ts [setId1] [setId2] ...
 * If no args given, processes all five known-unreliable sets.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const ALL_UNRELIABLE_SETS = ["sv03.5", "sv08.5", "sv10.5b", "sv10.5w", "me02.5"];
const DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function processSet(setId: string) {
  // Fresh Prisma client per set to avoid stale-connection issues on long
  // back-to-back enrichments.
  const adapter = new PrismaLibSql({ url: "file:dev.db" });
  const prisma = new PrismaClient({ adapter });

  try {
    const set = await prisma.cardSet.findUnique({
      where: { tcgdexSetId: setId },
      select: { id: true, name: true, tcgdexSetId: true },
    });
    if (!set) {
      console.log(`[${setId}] set not in DB, skipping`);
      return;
    }
    const cards = await prisma.card.findMany({
      where: { cardSetId: set.id },
      select: { id: true, name: true, localId: true },
      orderBy: { localId: "asc" },
    });
    console.log(`\n[${set.tcgdexSetId}] ${set.name} — ${cards.length} cards`);

    await prisma.card.updateMany({
      where: { id: { in: cards.map((c) => c.id) } },
      data: { priceUpdatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    // Import enrichCard lazily so it picks up the shared prisma singleton
    // (not ours — enrich-card.ts has its own `@/lib/prisma` import).
    const { enrichCard } = await import("../src/lib/tcgdex/enrich-card");

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
        console.warn(`  ! ${c.id}: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
      }
      await sleep(DELAY_MS);
    }
    console.log(`  [${set.tcgdexSetId}] done: ${done} refreshed, ${failed} failed`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const cliSets = process.argv.slice(2);
  const sets = cliSets.length > 0 ? cliSets : ALL_UNRELIABLE_SETS;
  console.log(`📦 Refreshing pricing in sets: ${sets.join(", ")}`);
  for (const setId of sets) {
    await processSet(setId);
  }
  console.log(`\n✅ All done`);
}

main().catch((e) => { console.error(e); process.exit(1); });
