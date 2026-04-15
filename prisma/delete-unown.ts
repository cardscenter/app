import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// One-shot: delete the Unseen Forces Unown Collection set and its cards.
// Same pattern as cleanup-sets.ts — clear optional FK references first.

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const set = await prisma.cardSet.findFirst({
    where: { tcgdexSetId: "exu" },
    select: { id: true, name: true },
  });
  if (!set) {
    console.log("Unown Collection already gone.");
    return;
  }

  console.log(`Deleting ${set.name} (${set.id})...`);
  await prisma.$transaction([
    prisma.listing.updateMany({ where: { cardSetId: set.id }, data: { cardSetId: null } }),
    prisma.auction.updateMany({ where: { cardSetId: set.id }, data: { cardSetId: null } }),
    prisma.claimsaleItem.updateMany({ where: { cardSetId: set.id }, data: { cardSetId: null } }),
    prisma.card.deleteMany({ where: { cardSetId: set.id } }),
    prisma.cardSet.delete({ where: { id: set.id } }),
  ]);
  console.log("✅ Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
