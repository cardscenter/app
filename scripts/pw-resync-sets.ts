import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { syncSetByPokewalletId } from "../src/lib/pokewallet/sync";

const TARGETS = process.argv[2]?.split(",") ?? [];

async function main() {
  if (TARGETS.length === 0) {
    console.log("Usage: npx tsx scripts/pw-resync-sets.ts <tcgdexSetId,tcgdexSetId,...>");
    process.exit(1);
  }
  const sets = await prisma.cardSet.findMany({
    where: { tcgdexSetId: { in: TARGETS }, pokewalletSetId: { not: null } },
    select: { id: true, name: true, tcgdexSetId: true, pokewalletSetId: true },
  });
  console.log(`Re-syncing ${sets.length} sets:\n`);
  for (const s of sets) {
    try {
      const r = await syncSetByPokewalletId(s.id);
      console.log(`✓ ${r.setName} (${s.tcgdexSetId} → ${s.pokewalletSetId}): ${r.updated} updated, ${r.unmatched} unmatched`);
    } catch (e) {
      console.error(`✗ ${s.name}:`);
      console.error(e);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
