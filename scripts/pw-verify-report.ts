// Genereert een verificatie-rapport: per gefixte set de duurste kaarten
// (hoogste risico bij verkeerde match) + de resterende prijsloze kaarten.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getMarktprijs } from "../src/lib/display-price";

// Sets die in deze sweep zijn aangeraakt (remap / mapper-fix / subset).
const TOUCHED = [
  "Unified Minds","Unbroken Bonds","Lost Thunder","Team Up","Cosmic Eclipse",
  "Celestial Storm","Forbidden Light","BREAKpoint","Ruby & Sapphire","Expedition Base Set",
  "Black & White","BW Black Star Promos","DP Black Star Promos","Wizards Black Star Promos",
  "McDonald's Collection 2011","McDonald's Collection 2012","Best of game","Pokémon Futsal 2020",
  "Gym Heroes","Gym Challenge","Neo Genesis","Neo Destiny","Neo Discovery","Neo Revelation",
  "Shining Fates","Generations","Legendary Treasures","Celebrations",
];

async function main() {
  console.log("════════════ STEEKPROEF: duurste nieuw-geprijsde kaarten per set ════════════");
  console.log("(controleer of kaart + variant kloppen met de getoonde Marktprijs)\n");
  for (const name of TOUCHED) {
    const set = await prisma.cardSet.findFirst({ where: { name }, select: { id: true, pokewalletSetId: true } });
    if (!set) continue;
    const cards = await prisma.card.findMany({
      where: { cardSetId: set.id },
      select: { name: true, localId: true, rarity: true, priceAvg: true, priceTrend: true,
        priceAvg7: true, priceTcgplayerNormalMarket: true, priceTcgplayerHolofoilMarket: true,
        priceReverseAvg: true, priceOverrideAvg: true },
    });
    const withPrice = cards
      .map((c) => ({ c, mp: getMarktprijs({ ...c } as any) }))
      .filter((x) => x.mp != null && x.mp > 0)
      .sort((a, b) => (b.mp ?? 0) - (a.mp ?? 0));
    if (withPrice.length === 0) continue;
    const top = withPrice.slice(0, 3);
    console.log(`■ ${name} (pw=${set.pokewalletSetId})`);
    for (const t of top) {
      console.log(`    €${(t.mp ?? 0).toFixed(2).padStart(8)}  #${t.c.localId.padEnd(6)} ${t.c.name}${t.c.rarity?` [${t.c.rarity}]`:""}`);
    }
  }

  console.log("\n════════════ RESTEREND PRIJSLOOS (handmatig of laten staan) ════════════");
  const allSets = await prisma.cardSet.findMany({ where: { cards: { some: {} } },
    select: { name: true, cards: { select: { name: true, localId: true, rarity: true,
      priceAvg: true, priceAvg7: true, priceTrend: true,
      priceTcgplayerNormalMarket: true, priceTcgplayerHolofoilMarket: true } } } });
  let n = 0;
  for (const s of allSets) {
    const pl = s.cards.filter((c) => c.priceAvg == null && c.priceAvg7 == null && c.priceTrend == null &&
      c.priceTcgplayerNormalMarket == null && c.priceTcgplayerHolofoilMarket == null);
    if (pl.length === 0) continue;
    n += pl.length;
    console.log(`  ${s.name} — ${pl.length}: ${pl.map((c) => `${c.localId}=${c.name}`).join(", ")}`);
  }
  console.log(`\n  Totaal resterend prijsloos: ${n} / ${(await prisma.card.count())}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
