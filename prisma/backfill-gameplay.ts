import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { enrichCard } from "../src/lib/tcgdex/enrich-card";

// Bulk-enrichment: populates `gameplayJson` + `spriteUrl` + reverse-holo
// pricing for every Card that hasn't been enriched yet. After this runs
// once, the detail page can render purely from the DB — zero external API
// calls needed on page load.
//
// Rate-limited (800ms between cards) to stay well under pokemontcg.io's
// 30-req/min free-tier limit. For a fresh DB (~22k cards) expect ~5 hours.
// Re-runnable — only touches rows still missing gameplayJson.

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const DELAY_MS = 800;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const limit = parseInt(process.argv[2] ?? "0", 10) || undefined;

  const missing = await prisma.card.findMany({
    where: { gameplayJson: null },
    select: { id: true },
    orderBy: { lastViewedAt: { sort: "desc", nulls: "last" } }, // hot cards first
    ...(limit ? { take: limit } : {}),
  });

  console.log(`🃏 ${missing.length} cards to enrich (delay ${DELAY_MS}ms/card).`);
  if (limit) console.log(`   (limited to ${limit} this run)`);

  let done = 0;
  let failed = 0;
  const start = Date.now();

  for (const c of missing) {
    try {
      await enrichCard(c.id);
      done++;
      if (done % 25 === 0) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        const rate = (done / Math.max(1, parseInt(elapsed, 10))).toFixed(1);
        console.log(`  ✓ ${done}/${missing.length} (${elapsed}s elapsed, ${rate}/s)`);
      }
    } catch (e) {
      failed++;
      console.warn(`  ! ${c.id}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n✅ ${done} enriched, ${failed} failed, out of ${missing.length}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
