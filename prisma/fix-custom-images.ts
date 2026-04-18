/**
 * Apply manual image overrides for cards where external sources have
 * no (or a poor quality) image. Run with: npx tsx prisma/fix-custom-images.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const IMAGE_MAP: Record<string, string> = {
  "svp-102": "https://cdn.shopify.com/s/files/1/0581/8400/7836/files/1790828.jpg?v=1718455627",
  "svp-208": "https://cdn.shopify.com/s/files/1/0581/8400/7836/files/victini-jumbo-oversized-svp-208-sv-black-star-promos_1cded5b1-7556-4df4-93b6-ffb546f20a4e.webp?v=1772706186",
  "svp-209": "https://cdn.shopify.com/s/files/1/0581/8400/7836/files/pokemon-thundurus-svp-209-1184792574_446x_b21d4d6f-40c1-4387-bcda-882f3af61ed2.jpg?v=1763909383",
  "svp-210": "https://cdn.shopify.com/s/files/1/0581/8400/7836/files/pokemon-tornadus-svp-210-1184796876_446x_950fb61a-9de0-4895-ab0a-14b6aad31bef.jpg?v=1776518569",
  "svp-211": "https://cdn.shopify.com/s/files/1/0581/8400/7836/files/SVP_211_R_EN.png?v=1759484784",
  "svp-212": "https://cdn.shopify.com/s/files/1/0581/8400/7836/files/large_69bc43e5-cea9-4c21-b1e4-ff65e226c17e.webp?v=1772463577",
  "svp-217": "https://cdn.shopify.com/s/files/1/0581/8400/7836/files/Team-Rockets-Nidoking-ex-Scarlet-Violet-Promo-SVP217.webp?v=1776517905",
  "svp-218": "https://cdn.shopify.com/s/files/1/0581/8400/7836/files/Team-Rockets-Persian-ex-Scarlet-Violet-Promo-SVP218.webp?v=1776518190",
};

async function main() {
  for (const [cardId, url] of Object.entries(IMAGE_MAP)) {
    const card = await prisma.card.findUnique({ where: { id: cardId }, select: { name: true } });
    if (!card) {
      console.log(`NOT FOUND: ${cardId}`);
      continue;
    }
    await prisma.card.update({ where: { id: cardId }, data: { imageUrlFull: url } });
    console.log(`UPDATED: ${cardId} (${card.name})`);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
