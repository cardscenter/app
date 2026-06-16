// READ-ONLY diagnose: welke kaarten hebben (nog) geen bruikbare prijs?
//
// "Bruikbare prijs" = er is iets om getMarktprijs() mee te voeden:
//   - priceAvg / priceAvg7 / priceTrend (CardMarket normal), OF
//   - priceTcgplayerNormalMarket / priceTcgplayerHolofoilMarket (TP fallback)
// Een kaart zonder een van die velden toont in de UI géén Marktprijs.
//
// Draai tegen Turso:
//   DATABASE_URL="libsql://cardscenter-cardscenter.aws-eu-west-1.turso.io" npx tsx scripts/pw-price-gap-audit.ts

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

type Row = {
  id: string;
  name: string;
  localId: string;
  rarity: string | null;
  pokewalletId: string | null;
  priceAvg: number | null;
  priceAvg7: number | null;
  priceTrend: number | null;
  priceTcgplayerNormalMarket: number | null;
  priceTcgplayerHolofoilMarket: number | null;
  priceReverseAvg: number | null;
  priceTcgplayerReverseMarket: number | null;
  setId: string;
  setName: string;
  pwSetId: string | null;
};

function hasAnyPriceSignal(c: Row): boolean {
  return (
    c.priceAvg != null ||
    c.priceAvg7 != null ||
    c.priceTrend != null ||
    c.priceTcgplayerNormalMarket != null ||
    c.priceTcgplayerHolofoilMarket != null
  );
}

async function main() {
  const cards = (await prisma.card.findMany({
    select: {
      id: true, name: true, localId: true, rarity: true, pokewalletId: true,
      priceAvg: true, priceAvg7: true, priceTrend: true,
      priceTcgplayerNormalMarket: true, priceTcgplayerHolofoilMarket: true,
      priceReverseAvg: true, priceTcgplayerReverseMarket: true,
      cardSet: { select: { id: true, name: true, pokewalletSetId: true } },
    },
  })) as unknown as Array<Record<string, unknown>>;

  const rows: Row[] = cards.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    localId: c.localId as string,
    rarity: c.rarity as string | null,
    pokewalletId: c.pokewalletId as string | null,
    priceAvg: c.priceAvg as number | null,
    priceAvg7: c.priceAvg7 as number | null,
    priceTrend: c.priceTrend as number | null,
    priceTcgplayerNormalMarket: c.priceTcgplayerNormalMarket as number | null,
    priceTcgplayerHolofoilMarket: c.priceTcgplayerHolofoilMarket as number | null,
    priceReverseAvg: c.priceReverseAvg as number | null,
    priceTcgplayerReverseMarket: c.priceTcgplayerReverseMarket as number | null,
    setId: (c.cardSet as { id: string }).id,
    setName: (c.cardSet as { name: string }).name,
    pwSetId: (c.cardSet as { pokewalletSetId: string | null }).pokewalletSetId,
  }));

  const total = rows.length;
  const noSignal = rows.filter((c) => !hasAnyPriceSignal(c));
  const noPwId = rows.filter((c) => c.pokewalletId == null);
  const pwIdButNoSignal = rows.filter((c) => c.pokewalletId != null && !hasAnyPriceSignal(c));
  const cmOnlyMissing = rows.filter((c) => c.priceAvg == null && hasAnyPriceSignal(c)); // toont prijs via TP-fallback maar geen CM

  console.log("================ PRICE GAP AUDIT ================");
  console.log(`Totaal kaarten:                         ${total}`);
  console.log(`GEEN enkel prijssignaal (geen UI-prijs): ${noSignal.length}  (${((noSignal.length/total)*100).toFixed(1)}%)`);
  console.log(`  - waarvan zonder pokewalletId:         ${noSignal.filter(c=>c.pokewalletId==null).length}`);
  console.log(`  - waarvan mét pokewalletId:            ${noSignal.filter(c=>c.pokewalletId!=null).length}`);
  console.log(`Kaarten zonder pokewalletId (totaal):    ${noPwId.length}`);
  console.log(`Kaarten mét pwId maar zonder signaal:    ${pwIdButNoSignal.length}`);
  console.log(`Kaarten met TP-fallback maar geen CM:    ${cmOnlyMissing.length} (tonen wél prijs)`);
  console.log("");

  // Groepeer de "geen-signaal" kaarten per set
  const bySet = new Map<string, { name: string; pwSetId: string | null; count: number; noPw: number; examples: string[] }>();
  for (const c of noSignal) {
    let g = bySet.get(c.setId);
    if (!g) { g = { name: c.setName, pwSetId: c.pwSetId, count: 0, noPw: 0, examples: [] }; bySet.set(c.setId, g); }
    g.count++;
    if (c.pokewalletId == null) g.noPw++;
    if (g.examples.length < 4) g.examples.push(`${c.name} #${c.localId}${c.rarity?` [${c.rarity}]`:""}`);
  }
  const sorted = [...bySet.values()].sort((a, b) => b.count - a.count);
  console.log("=== SETS MET MEESTE PRIJSLOZE KAARTEN ===");
  console.log("(pwSet=mapped status; noPw=zonder pokewalletId)");
  for (const g of sorted.slice(0, 40)) {
    const mapped = g.pwSetId ? `pw=${g.pwSetId}` : "GEEN-MAP";
    console.log(`  ${g.count.toString().padStart(4)} | ${g.name.slice(0,38).padEnd(38)} | ${mapped.padEnd(12)} | noPw=${g.noPw}`);
    console.log(`        e.g. ${g.examples.join(" · ")}`);
  }
  console.log("");
  console.log(`Sets met prijsloze kaarten: ${sorted.length}`);

  // Rariteits-breakdown van prijsloze kaarten — promo's/specials zijn vaak het probleem
  const byRarity = new Map<string, number>();
  for (const c of noSignal) {
    const r = c.rarity ?? "(null)";
    byRarity.set(r, (byRarity.get(r) ?? 0) + 1);
  }
  console.log("=== PRIJSLOZE KAARTEN PER RARITEIT ===");
  for (const [r, n] of [...byRarity.entries()].sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${n.toString().padStart(4)} | ${r}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
