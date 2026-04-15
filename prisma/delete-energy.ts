import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const sets = await prisma.cardSet.findMany({
    where: { tcgdexSetId: { in: ["mee", "sve"] } },
    select: { id: true, name: true },
  });
  if (sets.length === 0) { console.log("Nothing to delete."); return; }
  const ids = sets.map((s) => s.id);
  for (const s of sets) console.log(`Deleting ${s.name}...`);
  await prisma.$transaction([
    prisma.listing.updateMany({ where: { cardSetId: { in: ids } }, data: { cardSetId: null } }),
    prisma.auction.updateMany({ where: { cardSetId: { in: ids } }, data: { cardSetId: null } }),
    prisma.claimsaleItem.updateMany({ where: { cardSetId: { in: ids } }, data: { cardSetId: null } }),
    prisma.card.deleteMany({ where: { cardSetId: { in: ids } } }),
    prisma.cardSet.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log("✅ Done.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
