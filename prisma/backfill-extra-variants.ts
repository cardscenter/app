/**
 * One-time backfill: fetch PriceCharting prices for special reverse-holo
 * variants (Poké Ball / Master Ball / Ball / Energy) across the 4 sets that
 * have them. Only processes commons / uncommons / rares — inherently-foil
 * rarities don't receive Ball/Energy variants.
 *
 * Rate-limited to ~1 request/sec to be polite to PriceCharting. Variant
 * fetches go through Next.js's fetch cache (24h), so re-runs are fast.
 *
 * Usage: npx tsx prisma/backfill-extra-variants.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { enrichCard } from "../src/lib/tcgdex/enrich-card";
import { SPECIAL_VARIANT_SETS } from "../src/lib/tcgdex/special-variants";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const DELAY_MS = 1000; // ~1 card/sec → 2 fetches/sec to PriceCharting
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const setIds = Object.keys(SPECIAL_VARIANT_SETS);
  console.log(`🃏 Backfilling extra variants for sets: ${setIds.join(", ")}`);

  const sets = await prisma.cardSet.findMany({
    where: { tcgdexSetId: { in: setIds } },
    select: { id: true, name: true, tcgdexSetId: true },
  });
  if (sets.length === 0) {
    console.log("No matching sets in DB — did seeding run for these?");
    return;
  }

  let totalDone = 0;
  let totalFailed = 0;
  let totalWithVariants = 0;

  for (const set of sets) {
    // Only cards whose rarity matches (case-insensitive match on Common / Uncommon / Rare).
    // We let enrichCard run anyway for stale pricing refresh, but only the rare/common/uncommon
    // ones will attempt the PriceCharting scrape (gated inside enrichCard).
    const cards = await prisma.card.findMany({
      where: { cardSetId: set.id },
      select: { id: true, name: true, localId: true, rarity: true },
      orderBy: { localId: "asc" },
    });

    const eligible = cards.filter((c) => {
      const r = (c.rarity ?? "").toLowerCase();
      return r === "common" || r === "uncommon" || r === "rare";
    });

    console.log(`\n[${set.tcgdexSetId}] ${set.name} — ${eligible.length}/${cards.length} eligible (common/uncommon/rare)`);

    // Force pricing-stale on eligible cards so enrichCard re-runs the scrape
    await prisma.card.updateMany({
      where: { id: { in: eligible.map((c) => c.id) } },
      data: { priceUpdatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    const start = Date.now();
    let done = 0;
    let failed = 0;
    let withVariants = 0;
    for (const c of eligible) {
      try {
        const after = await enrichCard(c.id);
        if (after?.extraVariantsJson) {
          withVariants++;
          const parsed = JSON.parse(after.extraVariantsJson) as Record<string, number>;
          const summary = Object.entries(parsed)
            .map(([k, v]) => `${k}=€${v.toFixed(2)}`)
            .join(", ");
          console.log(`  ✓ #${c.localId.padEnd(4)} ${c.name.padEnd(28)} ${summary}`);
        }
        done++;
      } catch (e) {
        failed++;
        console.warn(`  ! #${c.localId} ${c.name}: ${e instanceof Error ? e.message : e}`);
      }
      if (done % 25 === 0 && done > 0) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        console.log(`  ... ${done}/${eligible.length} processed (${elapsed}s, ${withVariants} with variants)`);
      }
      await sleep(DELAY_MS);
    }
    totalDone += done;
    totalFailed += failed;
    totalWithVariants += withVariants;
    console.log(`  [${set.tcgdexSetId}] done: ${done} processed, ${failed} failed, ${withVariants} with variants`);
  }

  console.log(`\n✅ All sets done: ${totalDone} processed, ${totalFailed} failed, ${totalWithVariants} with variants`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
