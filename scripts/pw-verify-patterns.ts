import "dotenv/config";
import { prisma } from "../src/lib/prisma";

(async () => {
  const TARGETS = [
    { name: "Klink", localId: "061", set: "sv10.5b" },
    { name: "Pidove", localId: "071", set: "sv10.5b" },
    { name: "Snivy", localId: "001", set: "sv10.5b" },
  ];

  for (const t of TARGETS) {
    const c = await prisma.card.findFirst({
      where: { name: t.name, localId: t.localId, cardSet: { tcgdexSetId: t.set } },
      select: { name: true, localId: true, priceVariantsJson: true },
    });
    if (!c) { console.log(`✗ ${t.name} #${t.localId} not found`); continue; }
    console.log(`\n${c.name} #${c.localId}`);
    console.log(`  priceVariantsJson:`, c.priceVariantsJson ?? "(none)");
  }

  // Tel hoeveel cards in BB pattern-variants hebben
  const bbWithPatterns = await prisma.card.count({
    where: { cardSet: { tcgdexSetId: "sv10.5b" }, priceVariantsJson: { not: null } },
  });
  const bbTotal = await prisma.card.count({ where: { cardSet: { tcgdexSetId: "sv10.5b" } } });
  console.log(`\nBlack Bolt: ${bbWithPatterns}/${bbTotal} cards met patterns`);

  await prisma.$disconnect();
})();
