// Test-sync: draai syncSetByPokewalletId voor opgegeven sets (op naam) en
// rapporteer prijsdekking vóór/na. Schrijft echt naar de DB.
//   DATABASE_URL="libsql://...turso.io" npx tsx scripts/pw-test-sync.ts "Lost Thunder" "Gym Heroes" ...
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { syncSetByPokewalletId } from "../src/lib/pokewallet/sync";

async function coverage(setId: string) {
  const cards = await prisma.card.findMany({
    where: { cardSetId: setId },
    select: { priceAvg: true, priceAvg7: true, priceTrend: true,
      priceTcgplayerNormalMarket: true, priceTcgplayerHolofoilMarket: true, priceReverseAvg: true },
  });
  const total = cards.length;
  const withSignal = cards.filter((c) =>
    c.priceAvg != null || c.priceAvg7 != null || c.priceTrend != null ||
    c.priceTcgplayerNormalMarket != null || c.priceTcgplayerHolofoilMarket != null).length;
  const withCm = cards.filter((c) => c.priceAvg != null).length;
  const withRh = cards.filter((c) => c.priceReverseAvg != null).length;
  return { total, withSignal, withCm, withRh };
}

async function main() {
  const names = process.argv.slice(2);
  for (const name of names) {
    const set = await prisma.cardSet.findFirst({
      where: { name }, select: { id: true, name: true, pokewalletSetId: true },
    });
    if (!set?.pokewalletSetId) { console.log(`✗ ${name}: niet gevonden of geen pwId`); continue; }
    const before = await coverage(set.id);
    const t0 = Date.now();
    const res = await syncSetByPokewalletId(set.id);
    const after = await coverage(set.id);
    console.log(`\n■ ${set.name} (pw=${set.pokewalletSetId}) — ${((Date.now()-t0)/1000).toFixed(1)}s${res.fallbackUsed?" [fallback]":""}`);
    console.log(`   PW returned=${res.pokewalletReturned} matched=${res.matched} unmatched=${res.unmatched}`);
    console.log(`   signaal: ${before.withSignal}/${before.total} → ${after.withSignal}/${after.total}   CM: ${before.withCm}→${after.withCm}   RH: ${before.withRh}→${after.withRh}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
