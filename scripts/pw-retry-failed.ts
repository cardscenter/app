import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { syncSetByPokewalletId } from "../src/lib/pokewallet/sync";

const FAILED_TCGDEX_IDS = ["sv02", "sm12", "ex11", "ecard1"];

async function main() {
  const sets = await prisma.cardSet.findMany({
    where: { tcgdexSetId: { in: FAILED_TCGDEX_IDS }, pokewalletSetId: { not: null } },
    select: { id: true, name: true },
  });

  console.log(`Retrying ${sets.length} previously-failed sets...\n`);

  for (const set of sets) {
    try {
      const result = await syncSetByPokewalletId(set.id);
      console.log(
        `✓ ${result.setName}: ${result.updated} updated, ${result.unmatched} unmatched`,
      );
    } catch (e) {
      console.error(`✗ ${set.name}: ${(e as Error).message.slice(0, 200)}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
