// Voor elke unmapped set met cards: probeer een match te vinden in PokeWallet's
// /sets lijst, zodat we wat van de 24+ unmapped sets handmatig kunnen mappen.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { listAllSets } from "../src/lib/pokewallet/client";

(async () => {
  const pw = await listAllSets();
  console.log(`PokeWallet heeft ${pw.data.length} sets totaal\n`);

  const unmapped = await prisma.cardSet.findMany({
    where: { pokewalletSetId: null, cards: { some: {} } },
    select: { name: true, tcgdexSetId: true, _count: { select: { cards: true } } },
    orderBy: { name: "asc" },
  });

  for (const db of unmapped) {
    const dbName = db.name.toLowerCase();
    const matches = pw.data.filter(s => {
      const sName = s.name.toLowerCase();
      // Strip pokewallet's prefix (SWSH3:, SV1:, etc.)
      const stripped = sName.replace(/^[a-z]+\d*[a-z]?[:_]\s*(pokemon\s+card\s+)?/i, "").trim();
      return (
        sName.includes(dbName) ||
        stripped.includes(dbName) ||
        dbName.includes(stripped)
      );
    }).filter(s => s.language === "eng" || s.language === null);

    if (matches.length === 0) continue;
    console.log(`\n${db.name}  (${db.tcgdexSetId}, ${db._count.cards} cards)`);
    for (const m of matches.slice(0, 5)) {
      console.log(`  → ${m.set_id.padEnd(8)} ${m.set_code?.padEnd(8) ?? "—".padEnd(8)} ${m.name}`);
    }
  }

  await prisma.$disconnect();
})();
