import "dotenv/config";
import { prisma } from "../src/lib/prisma";

(async () => {
  const c = await prisma.card.findFirst({
    where: {
      name: { contains: process.argv[2] ?? "Gengar" },
      cardSet: { tcgdexSetId: process.argv[3] ?? "sv03.5" },
      localId: process.argv[4] ?? "094",
    },
    select: {
      id: true, name: true, localId: true, rarity: true,
      variants: true,
      priceAvg: true, priceReverseAvg: true,
      priceTcgplayerReverseMarket: true, priceTcgplayerReverseMid: true,
    },
  });
  console.log(JSON.stringify(c, null, 2));
  await prisma.$disconnect();
})();
