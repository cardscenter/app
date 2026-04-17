/**
 * Fix ALL Celebrations card images by linking to cards-center.nl images.
 * This overwrites both imageUrl (TCGdex) and imageUrlFull with the
 * cards-center.nl CDN URL so getCardImageUrl picks them up.
 *
 * Run with: npx tsx prisma/fix-celebrations-images.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

// Mapping: TCGdex card ID → cards-center.nl image URL
// Matched by card name + number from the website collection pages
const IMAGE_MAP: Record<string, string> = {
  // ── Main set (1-25) ──────────────────────────────────────────────
  "cel25-1":   "https://cards-center.nl/cdn/shop/products/1732999.jpg",   // Ho-Oh 01/25
  "cel25-2":   "https://cards-center.nl/cdn/shop/products/1733000.jpg",   // Reshiram 02/25
  "cel25-3":   "https://cards-center.nl/cdn/shop/products/1733001.jpg",   // Kyogre 03/25
  "cel25-4":   "https://cards-center.nl/cdn/shop/products/1733002.jpg",   // Palkia 04/25
  "cel25-5":   "https://cards-center.nl/cdn/shop/products/1733003.jpg",   // Pikachu 05/25
  "cel25-6":   "https://cards-center.nl/cdn/shop/products/1733004.jpg",   // Flying Pikachu V 06/25
  "cel25-7":   "https://cards-center.nl/cdn/shop/products/1733005.jpg",   // Flying Pikachu VMAX 07/25
  "cel25-8":   "https://cards-center.nl/cdn/shop/products/1733006.jpg",   // Surfing Pikachu V 08/25
  "cel25-9":   "https://cards-center.nl/cdn/shop/products/1733007.jpg",   // Surfing Pikachu VMAX 09/25
  "cel25-10":  "https://cards-center.nl/cdn/shop/products/1733008.jpg",   // Zekrom 10/25
  "cel25-11":  "https://cards-center.nl/cdn/shop/products/1733009.jpg",   // Mew 11/25
  "cel25-12":  "https://cards-center.nl/cdn/shop/products/1733010.jpg",   // Xerneas 12/25
  "cel25-13":  "https://cards-center.nl/cdn/shop/products/1733011.jpg",   // Cosmog 13/25
  "cel25-14":  "https://cards-center.nl/cdn/shop/products/1733012.jpg",   // Cosmoem 14/25
  "cel25-15":  "https://cards-center.nl/cdn/shop/products/1733013.jpg",   // Lunala 15/25
  "cel25-16":  "https://cards-center.nl/cdn/shop/products/1733014.jpg",   // Zacian V 16/25
  "cel25-17":  "https://cards-center.nl/cdn/shop/products/1733015.jpg",   // Groudon 17/25
  "cel25-18":  "https://cards-center.nl/cdn/shop/products/1733016.jpg",   // Zamazenta V 18/25
  "cel25-19":  "https://cards-center.nl/cdn/shop/products/1733017.jpg",   // Yveltal 19/25
  "cel25-20":  "https://cards-center.nl/cdn/shop/products/1733018.jpg",   // Dialga 20/25
  "cel25-21":  "https://cards-center.nl/cdn/shop/products/1733019.jpg",   // Solgaleo 21/25
  "cel25-22":  "https://cards-center.nl/cdn/shop/products/1733020.jpg",   // Lugia 22/25
  "cel25-23":  "https://cards-center.nl/cdn/shop/products/1733021.jpg",   // Professor's Research 23/25
  "cel25-24":  "https://cards-center.nl/cdn/shop/files/en_US-Ann25th-024-professors_research.webp", // Professor's Research 24/25
  "cel25-25":  "https://cards-center.nl/cdn/shop/products/1733023.jpg",   // Mew (Gold) 25/25

  // ── Classic Collection ───────────────────────────────────────────
  "cel25-2A":   "https://cards-center.nl/cdn/shop/products/1733024.jpg",  // Blastoise (BS2)
  "cel25-4A":   "https://cards-center.nl/cdn/shop/products/1733025.jpg",  // Charizard (BS4)
  "cel25-9A":   "https://cards-center.nl/cdn/shop/products/1733034.jpg",  // Team Magma's Groudon (MA9)
  "cel25-8A":   "https://cards-center.nl/cdn/shop/products/1733028.jpg",  // Dark Gyarados (TR8)
  "cel25-15A1": "https://cards-center.nl/cdn/shop/products/1733026.jpg",  // Venusaur (BS15)
  "cel25-73A":  "https://cards-center.nl/cdn/shop/products/1733027.jpg",  // Imposter Professor Oak (BS73)
  "cel25-93A":  "https://cards-center.nl/cdn/shop/products/1733037.jpg",  // Gardevoir ex �� (DF93)
  "cel25-15A3": "https://cards-center.nl/cdn/shop/products/1733030.jpg",  // Rocket's Zapdos (GC15)
  "cel25-15A4": "https://cards-center.nl/cdn/shop/products/1733039.jpg",  // Claydol (GE15)
  "cel25-88A":  "https://cards-center.nl/cdn/shop/products/1733036.jpg",  // Mew ex (LM88)
  "cel25-20A":  "https://cards-center.nl/cdn/shop/products/1733032.jpg",  // Cleffa (NG20)
  "cel25-66A":  "https://cards-center.nl/cdn/shop/products/1733033.jpg",  // Shining Magikarp (NR66)
  "cel25-15A2": "https://cards-center.nl/cdn/shop/products/1733029.jpg",  // Here Comes Team Rocket! (TR15)
  "cel25-24A":  "https://cards-center.nl/cdn/shop/products/1733031.jpg",  // _____'s Pikachu (WP24)
  "cel25-97A":  "https://cards-center.nl/cdn/shop/products/1733046.jpg",  // Xerneas EX (XY97)
  "cel25-60A":  "https://cards-center.nl/cdn/shop/products/1733048.jpg",  // Tapu Lele GX (GRI60)
  "cel25-107A": "https://cards-center.nl/cdn/shop/products/1733042.jpg",  // Donphan (HS107)
  "cel25-54A":  "https://cards-center.nl/cdn/shop/products/1733045.jpg",  // Mewtwo EX (NXD54)
  "cel25-76A":  "https://cards-center.nl/cdn/shop/products/1733047.jpg",  // M Rayquaza EX (ROS76)
  "cel25-109A": "https://cards-center.nl/cdn/shop/products/1733040.jpg",  // Luxray GL LV.X (RR109)
  "cel25-145A": "https://cards-center.nl/cdn/shop/products/1733041.jpg",  // Garchomp C LV.X (SV145)
  "cel25-86A":  "https://cards-center.nl/cdn/shop/products/1733035.jpg",  // Rocket's Admin. (TRR86)
  "cel25-113A": "https://cards-center.nl/cdn/shop/products/1733043.jpg",  // Reshiram (BLW113)
  "cel25-114A": "https://cards-center.nl/cdn/shop/products/1733044.jpg",  // Zekrom (BLW114)
  "cel25-17A":  "https://cards-center.nl/cdn/shop/products/1733038.jpg",  // Umbreon ☆ (POP517)
};

async function main() {
  let updated = 0;
  let notFound = 0;

  for (const [cardId, imageUrl] of Object.entries(IMAGE_MAP)) {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, name: true },
    });

    if (!card) {
      console.log(`NOT FOUND: ${cardId}`);
      notFound++;
      continue;
    }

    // Set imageUrlFull which takes priority in getCardImageUrl()
    await prisma.card.update({
      where: { id: cardId },
      data: { imageUrlFull: imageUrl },
    });

    console.log(`UPDATED: ${cardId} (${card.name})`);
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found`);
  await prisma.$disconnect();
}

main().catch(console.error);
