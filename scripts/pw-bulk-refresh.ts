// Bulk refresh ALL mapped sets via PokeWallet.
// First nullifies legacy CardMarket pricing fields, then re-fills from PW.

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { syncSetByPokewalletId } from "../src/lib/pokewallet/sync";

async function main() {
  const sets = await prisma.cardSet.findMany({
    where: { pokewalletSetId: { not: null }, cards: { some: {} } },
    select: { id: true, name: true, pokewalletSetId: true, _count: { select: { cards: true } } },
    orderBy: { releaseDate: "desc" },
  });

  console.log(`Found ${sets.length} mapped sets with cards. Total cards in scope: ${sets.reduce((s, c) => s + c._count.cards, 0)}\n`);

  // Step 1: Nullify legacy pricing fields (preserve priceOverride*)
  console.log("Nullifying old pricing data…");
  await prisma.card.updateMany({
    where: { cardSet: { pokewalletSetId: { not: null } } },
    data: {
      priceAvg: null,
      priceLow: null,
      priceTrend: null,
      priceAvg7: null,
      priceAvg30: null,
      priceReverseAvg: null,
      priceReverseLow: null,
      priceReverseTrend: null,
      priceReverseAvg7: null,
      priceReverseAvg30: null,
      priceTcgplayerNormalLow: null,
      priceTcgplayerNormalMid: null,
      priceTcgplayerNormalMarket: null,
      priceTcgplayerHolofoilLow: null,
      priceTcgplayerHolofoilMid: null,
      priceTcgplayerHolofoilMarket: null,
      priceTcgplayerReverseLow: null,
      priceTcgplayerReverseMid: null,
      priceTcgplayerReverseMarket: null,
      priceUpdatedAt: null,
      priceTcgplayerUpdatedAt: null,
    },
  });
  console.log("Done.\n");

  // Step 2: For each set, run sync (parallel-fetch internally, sequential per set to control rate)
  const startedAt = Date.now();
  const failures: { setId: string; setName: string; error: string }[] = [];
  let totalUpdated = 0;
  let totalUnmatched = 0;

  for (const [i, set] of sets.entries()) {
    try {
      const result = await syncSetByPokewalletId(set.id);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      totalUpdated += result.updated;
      totalUnmatched += result.unmatched;
      console.log(
        `[${i + 1}/${sets.length}] ${result.setName}: ${result.updated} updated, ${result.unmatched} unmatched, skipped ${result.variantsSkipped}v + ${result.sealedSkipped}s — ${elapsed}s`,
      );
    } catch (e) {
      const err = (e as Error).message;
      failures.push({ setId: set.id, setName: set.name, error: err });
      console.error(`[${i + 1}/${sets.length}] FAIL ${set.name}: ${err}`);
    }
  }

  console.log(`\nDone. Total updated: ${totalUpdated}, unmatched: ${totalUnmatched}, failed sets: ${failures.length}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  ${f.setName}: ${f.error}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
