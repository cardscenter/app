/**
 * Set rarity = "Promo" for all cards in Black Star Promo sets that currently
 * have rarity "None" or null. TCGdex often leaves promo rarity empty.
 *
 * Run with: npx tsx prisma/fix-promo-rarity.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find all sets with "Promo" in the name
  const promoSets = await prisma.cardSet.findMany({
    where: { name: { contains: "Promo" } },
    select: { id: true, name: true, tcgdexSetId: true },
  });
  console.log(`Found ${promoSets.length} promo sets:`);
  promoSets.forEach((s) => console.log(`  ${s.tcgdexSetId} — ${s.name}`));

  // Rarities that indicate "not yet flagged as promo" — these should all become Promo
  const overridableRarities = [null, "None", "", "Common", "Uncommon", "Rare", "Rare Holo", "Holo Rare"];

  let total = 0;
  for (const set of promoSets) {
    const result = await prisma.card.updateMany({
      where: {
        cardSetId: set.id,
        OR: overridableRarities.map((r) => r === null ? { rarity: null } : { rarity: r }),
      },
      data: { rarity: "Promo" },
    });
    if (result.count > 0) {
      console.log(`  ✓ ${set.tcgdexSetId}: ${result.count} cards updated`);
    }
    total += result.count;
  }

  console.log(`\nTotal cards updated: ${total}`);
  await prisma.$disconnect();
}

main().catch(console.error);
