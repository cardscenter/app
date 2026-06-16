// Sync ELKE set die momenteel ≥1 prijsloze kaart heeft (geen enkel
// prijssignaal), met de verbeterde sync-code. Rapporteert per set voor/na.
//   DATABASE_URL="libsql://...turso.io" npx tsx scripts/pw-sync-gaps.ts [minPriceless]
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { syncSetByPokewalletId } from "../src/lib/pokewallet/sync";

function pricelessOf(c: { priceAvg: number|null; priceAvg7: number|null; priceTrend: number|null;
  priceTcgplayerNormalMarket: number|null; priceTcgplayerHolofoilMarket: number|null }): boolean {
  return c.priceAvg == null && c.priceAvg7 == null && c.priceTrend == null &&
    c.priceTcgplayerNormalMarket == null && c.priceTcgplayerHolofoilMarket == null;
}

async function main() {
  const minPriceless = Number(process.argv[2] ?? "1");
  const sets = await prisma.cardSet.findMany({
    where: { pokewalletSetId: { not: null }, cards: { some: {} } },
    select: { id: true, name: true, pokewalletSetId: true,
      cards: { select: { priceAvg: true, priceAvg7: true, priceTrend: true,
        priceTcgplayerNormalMarket: true, priceTcgplayerHolofoilMarket: true } } },
  });

  const targets = sets
    .map((s) => ({ ...s, priceless: s.cards.filter(pricelessOf).length, total: s.cards.length }))
    .filter((s) => s.priceless >= minPriceless)
    .sort((a, b) => b.priceless - a.priceless);

  console.log(`${targets.length} sets met ≥${minPriceless} prijsloze kaarten. Start sync…\n`);
  let totalBefore = 0, totalAfter = 0, totalCards = 0;
  for (const s of targets) {
    totalBefore += s.priceless; totalCards += s.total;
    try {
      const res = await syncSetByPokewalletId(s.id);
      const after = await prisma.card.findMany({ where: { cardSetId: s.id },
        select: { priceAvg: true, priceAvg7: true, priceTrend: true,
          priceTcgplayerNormalMarket: true, priceTcgplayerHolofoilMarket: true } });
      const stillPriceless = after.filter(pricelessOf).length;
      totalAfter += stillPriceless;
      const fixed = s.priceless - stillPriceless;
      const flag = stillPriceless > 0 ? ` ⚠ ${stillPriceless} blijft prijsloos` : " ✓";
      console.log(`${s.name.slice(0,34).padEnd(34)} pw=${String(s.pokewalletSetId).padEnd(7)} ${s.priceless}→${stillPriceless} (-${fixed})${res.fallbackUsed?" [fb]":""}${flag}`);
    } catch (e) {
      console.log(`${s.name.slice(0,34).padEnd(34)} pw=${s.pokewalletSetId} ✗ FOUT: ${(e as Error).message.slice(0,80)}`);
      totalAfter += s.priceless;
    }
  }
  console.log(`\n──────── TOTAAL: ${totalBefore} prijsloos → ${totalAfter} prijsloos (over ${totalCards} kaarten in ${targets.length} sets) ────────`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
