// Sync alle gemapte sets waar in de laatste 24u ZERO cards zijn geüpdatet.
// Dit pakt nieuwe mappings + sets die op een eerdere run hebben gefaald.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { syncSetByPokewalletId } from "../src/lib/pokewallet/sync";

(async () => {
  const day1 = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sets = await prisma.cardSet.findMany({
    where: { pokewalletSetId: { not: null }, cards: { some: {} } },
    select: {
      id: true,
      name: true,
      tcgdexSetId: true,
      pokewalletSetId: true,
      cards: { select: { priceUpdatedAt: true } },
    },
  });

  const stale = sets.filter(
    (s) => s.cards.filter((c) => c.priceUpdatedAt && c.priceUpdatedAt >= day1).length === 0,
  );

  console.log(`Vond ${stale.length} stale sets om te syncen (van ${sets.length} mapped sets met cards):`);
  for (const s of stale) console.log(`  ${s.name}  (${s.tcgdexSetId} → ${s.pokewalletSetId})`);

  console.log("\nStarting sync…\n");
  let ok = 0,
    fail = 0;
  for (const s of stale) {
    try {
      const r = await syncSetByPokewalletId(s.id);
      console.log(`✓ ${r.setName}: ${r.updated} updated, ${r.unmatched} unmatched`);
      ok++;
    } catch (e) {
      console.error(`✗ ${s.name}:`);
      console.error(e);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
  await prisma.$disconnect();
})();
