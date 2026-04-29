import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const cards = await prisma.card.findMany({
  where: { name: "Eevee", localId: "173" },
  select: {
    id: true, name: true, localId: true, rarity: true,
    pokewalletId: true,
    priceAvg: true, priceLow: true, priceTrend: true, priceAvg7: true, priceAvg30: true,
    priceTcgplayerNormalMarket: true, priceTcgplayerHolofoilMarket: true, priceTcgplayerReverseMarket: true,
    priceOverrideAvg: true, priceOverrideReason: true,
    cardSet: { select: { name: true, pokewalletSetId: true, releaseDate: true } },
  },
});
for (const c of cards) {
  console.log(JSON.stringify(c, null, 2));
}
await prisma.$disconnect();
