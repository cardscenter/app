// Manueel een set volledig importeren: kaartlijst uit TCGdex aanmaken +
// daarna prijzen uit PokeWallet syncen.
//
// Gebruik:
//   npx tsx scripts/pw-import-set.ts <query>
//
// <query> matcht op CardSet.tcgdexSetId, pokewalletSetId, of (deel van) naam.
// Bv:  npx tsx scripts/pw-import-set.ts "Chaos Rising"
//      npx tsx scripts/pw-import-set.ts me04
//      npx tsx scripts/pw-import-set.ts 24655
//
// De set-shell moet al bestaan (wordt aangemaakt door de catalogus-sync /
// discoverAndCreateNewSets). Dit script vult 'm met kaarten + prijzen.

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { populateSetCards } from "../src/lib/pokewallet/populate-cards";
import { syncSetByPokewalletId } from "../src/lib/pokewallet/sync";

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.log('Usage: npx tsx scripts/pw-import-set.ts "<naam | tcgdexSetId | pokewalletSetId>"');
    process.exit(1);
  }

  const set = await prisma.cardSet.findFirst({
    where: {
      OR: [
        { tcgdexSetId: query },
        { pokewalletSetId: query },
        { pokewalletSetCode: query.toUpperCase() },
        { name: { contains: query } },
      ],
    },
    select: { id: true, name: true, tcgdexSetId: true, pokewalletSetId: true, _count: { select: { cards: true } } },
  });

  if (!set) {
    console.error(`✗ Geen CardSet gevonden voor "${query}". Draai eerst de catalogus-sync zodat de shell bestaat.`);
    process.exit(1);
  }

  console.log(`Set: ${set.name}`);
  console.log(`  tcgdexSetId=${set.tcgdexSetId} pokewalletSetId=${set.pokewalletSetId} cards=${set._count.cards}\n`);

  console.log("→ Stap 1: kaarten aanmaken uit TCGdex…");
  const pop = await populateSetCards(set.id);
  if (pop.error) {
    console.error(`  ✗ ${pop.error}`);
  } else {
    console.log(`  ✓ ${pop.created} nieuw aangemaakt, ${pop.skipped} bestonden al (tcgdex=${pop.tcgdexSetId})`);
  }

  if (!set.pokewalletSetId) {
    console.log("\n⚠ Geen pokewalletSetId — prijs-sync overgeslagen. Map de set eerst aan PokeWallet.");
    return;
  }

  console.log("\n→ Stap 2: prijzen syncen uit PokeWallet…");
  const sync = await syncSetByPokewalletId(set.id);
  console.log(`  ✓ ${sync.updated} kaarten geprijsd, ${sync.unmatched} zonder match` + (sync.fallbackUsed ? " (fallback gebruikt)" : ""));

  const withPrice = await prisma.card.count({
    where: { cardSetId: set.id, priceAvg: { not: null } },
  });
  const withReverse = await prisma.card.count({
    where: { cardSetId: set.id, priceReverseAvg: { not: null } },
  });
  const total = await prisma.card.count({ where: { cardSetId: set.id } });
  console.log(`\nResultaat: ${total} kaarten · ${withPrice} met normale prijs · ${withReverse} met reverse-holo prijs`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
