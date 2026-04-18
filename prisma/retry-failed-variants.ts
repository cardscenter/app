/**
 * Retry PriceCharting scrape for cards where it failed the first time.
 * Targets cards in special-variant sets whose extraVariantsJson is still null.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { enrichCard } from "../src/lib/tcgdex/enrich-card";
import { SPECIAL_VARIANT_SETS } from "../src/lib/tcgdex/special-variants";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const sets = await prisma.cardSet.findMany({
    where: { tcgdexSetId: { in: Object.keys(SPECIAL_VARIANT_SETS) } },
    select: { id: true, tcgdexSetId: true },
  });

  const cards = await prisma.card.findMany({
    where: {
      cardSetId: { in: sets.map((s) => s.id) },
      extraVariantsJson: null,
      rarity: { in: ["Common", "Uncommon", "Rare"] },
    },
    select: { id: true, name: true, localId: true },
  });

  console.log(`🔁 Retrying ${cards.length} cards with missing extra variants`);

  let done = 0;
  let ok = 0;
  for (const c of cards) {
    try {
      await prisma.card.update({
        where: { id: c.id },
        data: { priceUpdatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      });
      const after = await enrichCard(c.id);
      if (after?.extraVariantsJson) ok++;
      done++;
    } catch (e) {
      console.warn(`  ! ${c.id} ${c.name}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(500);
  }

  console.log(`✅ Retried ${done} cards, ${ok} now have variants`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
