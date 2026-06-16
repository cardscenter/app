// Celebrations: Classic Collection (DB localId "NNNA") matchen op NAAM tegen
// PW-set 2931 (die originele kaartnummers gebruikt, geen "A"-suffix). Schrijft
// pokewalletId + pricing + snapshot. --apply om te schrijven.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { fetchAllPagesForSet } from "../src/lib/pokewallet/client";
import { mapPokewalletPricing } from "../src/lib/pokewallet/pricing";
import { getMarktprijs, getMarktprijsReverseHolo } from "../src/lib/display-price";

const CC_PW_SET = "2931";

function normName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const set = await prisma.cardSet.findFirst({ where: { name: "Celebrations" }, select: { id: true } });
  if (!set) throw new Error("Celebrations niet gevonden");

  const dbCards = await prisma.card.findMany({
    where: { cardSetId: set.id, localId: { endsWith: "A" } , priceAvg: null, priceTcgplayerNormalMarket: null },
    select: { id: true, name: true, localId: true, rarity: true, pokewalletId: true },
  });
  // ook de "15A1"-achtige: endsWith "A" mist die. Pak alle resterende prijsloze.
  const allPl = await prisma.card.findMany({
    where: { cardSetId: set.id, priceAvg: null, priceAvg7: null, priceTrend: null,
      priceTcgplayerNormalMarket: null, priceTcgplayerHolofoilMarket: null },
    select: { id: true, name: true, localId: true, rarity: true, pokewalletId: true },
  });

  const pw = await fetchAllPagesForSet(CC_PW_SET);
  const pwByName = new Map<string, any[]>();
  for (const c of pw) {
    const k = normName(c.card_info.name);
    if (!pwByName.has(k)) pwByName.set(k, []);
    pwByName.get(k)!.push(c);
  }
  console.log(`PW 2931 leverde ${pw.length} kaarten. DB prijsloze CC: ${allPl.length}\n`);

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  let matched = 0;
  for (const db of allPl) {
    let cands = pwByName.get(normName(db.name)) ?? [];
    // Fallback: match op nummer-prefix van localId ("93A"→"93", "107A"→"107")
    // tegen het PW-kaartnummer-prefix — vangt namen met (Delta Species)/(Prime).
    if (cands.length === 0) {
      const numPrefix = db.localId.match(/^(\d+)/)?.[1];
      if (numPrefix) {
        cands = pw.filter((c) => (c.card_info.card_number ?? "").split("/")[0].replace(/^0+/, "") === numPrefix
          && normName(c.card_info.name).includes(normName(db.name).slice(0, 6)));
      }
    }
    const chosen = cands.find((c) => c.cardmarket?.prices?.length) ?? cands.find((c) => c.tcgplayer?.prices?.length) ?? cands[0];
    if (!chosen) { console.log(`  ✗ geen match: ${db.localId}=${db.name}`); continue; }
    const pricing = mapPokewalletPricing(chosen);
    const snapN = getMarktprijs({ ...pricing, rarity: db.rarity } as any);
    const snapR = getMarktprijsReverseHolo(pricing as any);
    console.log(`  ✓ ${db.localId.padEnd(5)} ${db.name.slice(0,24).padEnd(24)} → ${chosen.card_info.card_number} Marktprijs=${snapN ?? "-"}`);
    matched++;
    if (apply) {
      // pokewalletId kan al door een andere kaart geclaimd zijn — dan alleen pricing.
      const taken = await prisma.card.findFirst({ where: { pokewalletId: chosen.id, NOT: { id: db.id } }, select: { id: true } });
      await prisma.card.update({ where: { id: db.id },
        data: taken ? pricing : { pokewalletId: chosen.id, ...pricing } });
      await prisma.cardPriceHistory.upsert({
        where: { cardId_date: { cardId: db.id, date: todayUtc } },
        create: { cardId: db.id, date: todayUtc, priceNormal: snapN, priceReverse: snapR },
        update: { priceNormal: snapN, priceReverse: snapR },
      });
    }
  }
  console.log(`\n${matched}/${allPl.length} gematcht${apply ? " en geschreven" : " (dry-run — gebruik --apply)"}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
