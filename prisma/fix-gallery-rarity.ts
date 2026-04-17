/**
 * Fix rarity for Trainer Gallery (TG) and Galarian Gallery (GG) cards.
 * Run with: npx tsx prisma/fix-gallery-rarity.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tg = await prisma.card.updateMany({
    where: { localId: { startsWith: "TG" } },
    data: { rarity: "Trainer Gallery" },
  });
  console.log(`TG cards updated: ${tg.count}`);

  const gg = await prisma.card.updateMany({
    where: { localId: { startsWith: "GG" } },
    data: { rarity: "Galarian Gallery" },
  });
  console.log(`GG cards updated: ${gg.count}`);

  await prisma.$disconnect();
}

main().catch(console.error);
