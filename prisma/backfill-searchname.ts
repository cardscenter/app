/**
 * Backfill Card.searchName for all cards.
 * Run with: npx tsx prisma/backfill-searchname.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

function normalizeForSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\-.:]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const cards = await prisma.card.findMany({
    select: { id: true, name: true },
  });

  console.log(`Backfilling searchName for ${cards.length} cards...`);

  let updated = 0;
  const BATCH = 50;

  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    for (const card of batch) {
      await prisma.card.update({
        where: { id: card.id },
        data: { searchName: normalizeForSearch(card.name) },
      });
    }
    updated += batch.length;
    if (updated % 2000 === 0 || updated === cards.length) {
      console.log(`  ${updated}/${cards.length}`);
    }
  }

  console.log(`Done: ${updated} cards updated`);
  await prisma.$disconnect();
}

main().catch(console.error);
