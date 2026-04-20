import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getMarktprijs, getMarktprijsReverseHolo } from "../src/lib/display-price";

const SEARCH = process.argv[2] ?? "Chien-Pao";
const SET_FILTER = process.argv[3]; // bv "sv02" of "Paldea Evolved"

(async () => {
  const cards = await prisma.card.findMany({
    where: {
      OR: [
        { name: { contains: SEARCH } },
        { localId: SEARCH },
      ],
      ...(SET_FILTER
        ? {
            cardSet: {
              OR: [
                { name: { contains: SET_FILTER } },
                { tcgdexSetId: SET_FILTER },
              ],
            },
          }
        : {}),
    },
    select: {
      id: true,
      pokewalletId: true,
      name: true,
      localId: true,
      rarity: true,
      cardSet: { select: { name: true, tcgdexSetId: true, pokewalletSetId: true } },
      priceOverrideAvg: true,
      priceOverrideReverseAvg: true,
      priceOverrideReason: true,
      priceAvg: true,
      priceLow: true,
      priceTrend: true,
      priceAvg7: true,
      priceAvg30: true,
      priceReverseAvg: true,
      priceReverseLow: true,
      priceReverseTrend: true,
      priceReverseAvg7: true,
      priceTcgplayerNormalLow: true,
      priceTcgplayerNormalMid: true,
      priceTcgplayerNormalMarket: true,
      priceTcgplayerHolofoilMarket: true,
      priceTcgplayerReverseMarket: true,
      priceUpdatedAt: true,
    },
    orderBy: [{ cardSet: { name: "asc" } }, { localId: "asc" }],
    take: 20,
  });

  if (cards.length === 0) {
    console.log("Geen kaarten gevonden voor:", SEARCH, SET_FILTER ?? "");
    process.exit(0);
  }

  for (const c of cards) {
    const mark = getMarktprijs(c);
    const markRH = getMarktprijsReverseHolo({
      priceReverseAvg: c.priceReverseAvg,
      priceReverseLow: c.priceReverseLow,
      priceReverseTrend: c.priceReverseTrend,
      priceReverseAvg7: c.priceReverseAvg7,
      priceTcgplayerReverseMarket: c.priceTcgplayerReverseMarket,
    });

    console.log(`\n=== ${c.name} #${c.localId} (${c.rarity}) — ${c.cardSet?.name} ===`);
    console.log(`  pokewalletId:   ${c.pokewalletId ?? "(none)"}`);
    if (c.priceOverrideAvg != null) console.log(`  ⚠ OVERRIDE avg: €${c.priceOverrideAvg} (${c.priceOverrideReason ?? ""})`);
    if (c.priceOverrideReverseAvg != null) console.log(`  ⚠ OVERRIDE RH: €${c.priceOverrideReverseAvg}`);
    console.log(`  pwSetId:        ${c.cardSet?.pokewalletSetId ?? "(none)"}`);
    console.log(`  Updated:        ${c.priceUpdatedAt?.toISOString() ?? "(never)"}`);
    console.log(`  --- CardMarket NORMAL ---`);
    console.log(`    avg:   €${c.priceAvg ?? "—"}    low: €${c.priceLow ?? "—"}    trend: €${c.priceTrend ?? "—"}`);
    console.log(`    avg7:  €${c.priceAvg7 ?? "—"}   avg30: €${c.priceAvg30 ?? "—"}`);
    console.log(`  --- CardMarket REVERSE HOLO ---`);
    console.log(`    avg:   €${c.priceReverseAvg ?? "—"}    low: €${c.priceReverseLow ?? "—"}    trend: €${c.priceReverseTrend ?? "—"}`);
    console.log(`  --- TCGPlayer (USD) ---`);
    console.log(`    Normal mkt: $${c.priceTcgplayerNormalMarket ?? "—"}    Holo mkt: $${c.priceTcgplayerHolofoilMarket ?? "—"}    Reverse: $${c.priceTcgplayerReverseMarket ?? "—"}`);
    console.log(`  >>> MARKTPRIJS:           €${mark ?? "—"}`);
    console.log(`  >>> MARKTPRIJS RH:        €${markRH ?? "—"}`);
  }

  await prisma.$disconnect();
})();
