import "dotenv/config";
import { prisma } from "../src/lib/prisma";

(async () => {
  const totalSets = await prisma.cardSet.count();
  const mappedSets = await prisma.cardSet.count({ where: { pokewalletSetId: { not: null } } });
  const setsWithCards = await prisma.cardSet.count({ where: { cards: { some: {} } } });
  const totalCards = await prisma.card.count();
  const cardsWithPwId = await prisma.card.count({ where: { pokewalletId: { not: null } } });
  const cardsWithPriceAvg = await prisma.card.count({ where: { priceAvg: { not: null } } });
  const cardsWithReverse = await prisma.card.count({ where: { priceReverseAvg: { not: null } } });
  const cardsWithTp = await prisma.card.count({ where: { priceTcgplayerNormalMarket: { not: null } } });

  const day1 = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const day2 = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const day7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const updated24h = await prisma.card.count({ where: { priceUpdatedAt: { gte: day1 } } });
  const updated48h = await prisma.card.count({ where: { priceUpdatedAt: { gte: day2 } } });
  const updated7d = await prisma.card.count({ where: { priceUpdatedAt: { gte: day7 } } });

  console.log("=== SET STATUS ===");
  console.log(`Sets totaal:              ${totalSets}`);
  console.log(`Sets met pokewalletId:    ${mappedSets}`);
  console.log(`Sets met cards:           ${setsWithCards}`);
  console.log("");
  console.log("=== CARD STATUS ===");
  console.log(`Cards totaal:             ${totalCards}`);
  console.log(`Cards met pokewalletId:   ${cardsWithPwId}  (${((cardsWithPwId/totalCards)*100).toFixed(1)}%)`);
  console.log(`Cards met priceAvg (CM):  ${cardsWithPriceAvg}  (${((cardsWithPriceAvg/totalCards)*100).toFixed(1)}%)`);
  console.log(`Cards met RH (CM):        ${cardsWithReverse}`);
  console.log(`Cards met TP normal:      ${cardsWithTp}`);
  console.log("");
  console.log("=== FRESHNESS ===");
  console.log(`Updated last 24h:         ${updated24h}  (${((updated24h/totalCards)*100).toFixed(1)}%)`);
  console.log(`Updated last 48h:         ${updated48h}`);
  console.log(`Updated last 7d:          ${updated7d}`);
  console.log("");

  // Sets met cards maar nog niet gesynced
  const setsWithCardsButNoSync = await prisma.cardSet.findMany({
    where: {
      cards: { some: {} },
      OR: [
        { pokewalletSetId: null },
        { cards: { some: { priceUpdatedAt: { lt: day7 } } } },
      ],
    },
    select: {
      name: true,
      tcgdexSetId: true,
      pokewalletSetId: true,
      _count: { select: { cards: true } },
    },
    orderBy: { name: "asc" },
  });

  // Sets waar GEEN enkele card recent geüpdatet is
  const allSetsWithCards = await prisma.cardSet.findMany({
    where: { cards: { some: {} }, pokewalletSetId: { not: null } },
    select: {
      name: true,
      tcgdexSetId: true,
      pokewalletSetId: true,
      cards: {
        select: { priceUpdatedAt: true, priceAvg: true },
      },
    },
  });

  const setsNotSyncedRecently: { name: string; tcgdexSetId: string | null; total: number; recent: number; withPrice: number }[] = [];
  for (const s of allSetsWithCards) {
    const recent = s.cards.filter(c => c.priceUpdatedAt && c.priceUpdatedAt >= day2).length;
    const withPrice = s.cards.filter(c => c.priceAvg !== null).length;
    if (recent === 0) {
      setsNotSyncedRecently.push({
        name: s.name,
        tcgdexSetId: s.tcgdexSetId,
        total: s.cards.length,
        recent,
        withPrice,
      });
    }
  }

  console.log("=== SETS NIET GESYNCED LAATSTE 48u ===");
  if (setsNotSyncedRecently.length === 0) {
    console.log("(geen — alles fris!)");
  } else {
    for (const s of setsNotSyncedRecently.slice(0, 30)) {
      console.log(`  ${s.name.padEnd(40)} (${s.tcgdexSetId?.padEnd(10)}) ${s.total} cards, ${s.withPrice} met prijs`);
    }
    if (setsNotSyncedRecently.length > 30) {
      console.log(`  ... en ${setsNotSyncedRecently.length - 30} meer`);
    }
  }

  console.log("");
  console.log("=== UNMAPPED SETS MET CARDS ===");
  const unmapped = setsWithCardsButNoSync.filter(s => !s.pokewalletSetId);
  if (unmapped.length === 0) {
    console.log("(geen)");
  } else {
    for (const s of unmapped.slice(0, 20)) {
      console.log(`  ${s.name.padEnd(40)} (${s.tcgdexSetId?.padEnd(10)}) ${s._count.cards} cards`);
    }
  }

  await prisma.$disconnect();
})();
