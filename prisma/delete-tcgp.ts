import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Delete all Pokémon TCG Pocket data — series "tcgp" + all its sets and cards.
// TCG Pocket is a separate mobile-game product and never relevant here.

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const series = await prisma.series.findFirst({
    where: { tcgdexSeriesId: "tcgp" },
    include: { cardSets: { select: { id: true, name: true } } },
  });
  if (!series) { console.log("No TCG Pocket series — nothing to delete."); return; }

  const setIds = series.cardSets.map((s) => s.id);
  console.log(`Found series "${series.name}" with ${setIds.length} sets.`);

  await prisma.$transaction([
    prisma.listing.updateMany({ where: { cardSetId: { in: setIds } }, data: { cardSetId: null } }),
    prisma.auction.updateMany({ where: { cardSetId: { in: setIds } }, data: { cardSetId: null } }),
    prisma.claimsaleItem.updateMany({ where: { cardSetId: { in: setIds } }, data: { cardSetId: null } }),
    prisma.card.deleteMany({ where: { cardSetId: { in: setIds } } }),
    prisma.cardSet.deleteMany({ where: { id: { in: setIds } } }),
    prisma.series.delete({ where: { id: series.id } }),
  ]);
  console.log("✅ TCG Pocket series + all its sets and cards deleted.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
