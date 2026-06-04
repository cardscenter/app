// Maintenance: verwijdert de "Onbekend (te categoriseren)" Series +
// alle CardSets eronder, MITS geen van die CardSets cards heeft.
//
// Use-case: als discoverAndCreateNewSets ten onrechte oude/duplicate
// sets als nieuw heeft aangemaakt en je wilt opruimen voordat admin ze
// handmatig naar de juiste Era verplaatst. Veilig: weigert te draaien
// als er sets met cards onder hangen.
//
// Gebruik: npx tsx scripts/pw-clean-fallback-series.ts

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const series = await prisma.series.findFirst({
    where: { name: "Onbekend (te categoriseren)" },
    include: {
      cardSets: {
        select: { id: true, name: true, _count: { select: { cards: true } } },
      },
    },
  });

  if (!series) {
    console.log("✓ Geen 'Onbekend'-series gevonden, niets te cleanen.");
    return;
  }

  console.log(`Onbekend-series bevat ${series.cardSets.length} CardSets`);
  const withCards = series.cardSets.filter((s) => s._count.cards > 0);
  if (withCards.length > 0) {
    console.error(`❌ STOP — ${withCards.length} sets bevatten cards, niet veilig om te deleten:`);
    for (const s of withCards.slice(0, 5)) {
      console.error(`   - ${s.name} (${s._count.cards} cards)`);
    }
    process.exit(1);
  }

  const setIds = series.cardSets.map((s) => s.id);
  const r1 = await prisma.cardSet.deleteMany({ where: { id: { in: setIds } } });
  console.log(`✓ ${r1.count} CardSets verwijderd`);
  const r2 = await prisma.series.delete({ where: { id: series.id } });
  console.log(`✓ Series '${r2.name}' verwijderd`);
}

main()
  .catch((e) => {
    console.error("❌ Cleanup faalde:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
