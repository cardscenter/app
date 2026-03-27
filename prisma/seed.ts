import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // --- Categories ---
  const pokemon = await prisma.category.upsert({
    where: { slug: "pokemon" },
    update: {},
    create: { name: "Pokémon", slug: "pokemon" },
  });

  // --- Pokémon Series & Sets ---
  const pokemonSeries = [
    {
      name: "Base Set Era",
      sets: ["Base Set", "Jungle", "Fossil", "Base Set 2", "Team Rocket"],
    },
    {
      name: "Neo Era",
      sets: ["Neo Genesis", "Neo Discovery", "Neo Revelation", "Neo Destiny"],
    },
    {
      name: "e-Card Era",
      sets: ["Expedition Base Set", "Aquapolis", "Skyridge"],
    },
    {
      name: "EX Era",
      sets: [
        "Ruby & Sapphire",
        "Sandstorm",
        "Dragon",
        "Team Magma vs Team Aqua",
        "Hidden Legends",
        "FireRed & LeafGreen",
        "Team Rocket Returns",
        "Deoxys",
        "Emerald",
        "Unseen Forces",
        "Delta Species",
        "Legend Maker",
        "Holon Phantoms",
        "Crystal Guardians",
        "Dragon Frontiers",
        "Power Keepers",
      ],
    },
    {
      name: "Diamond & Pearl Era",
      sets: [
        "Diamond & Pearl",
        "Mysterious Treasures",
        "Secret Wonders",
        "Great Encounters",
        "Majestic Dawn",
        "Legends Awakened",
        "Stormfront",
        "Platinum",
        "Rising Rivals",
        "Supreme Victors",
        "Arceus",
      ],
    },
    {
      name: "HeartGold & SoulSilver Era",
      sets: [
        "HeartGold & SoulSilver",
        "Unleashed",
        "Undaunted",
        "Triumphant",
        "Call of Legends",
      ],
    },
    {
      name: "Black & White Era",
      sets: [
        "Black & White",
        "Emerging Powers",
        "Noble Victories",
        "Next Destinies",
        "Dark Explorers",
        "Dragons Exalted",
        "Boundaries Crossed",
        "Plasma Storm",
        "Plasma Freeze",
        "Plasma Blast",
        "Legendary Treasures",
      ],
    },
    {
      name: "XY Era",
      sets: [
        "XY",
        "Flashfire",
        "Furious Fists",
        "Phantom Forces",
        "Primal Clash",
        "Roaring Skies",
        "Ancient Origins",
        "BREAKthrough",
        "BREAKpoint",
        "Fates Collide",
        "Steam Siege",
        "Evolutions",
      ],
    },
    {
      name: "Sun & Moon Era",
      sets: [
        "Sun & Moon",
        "Guardians Rising",
        "Burning Shadows",
        "Crimson Invasion",
        "Ultra Prism",
        "Forbidden Light",
        "Celestial Storm",
        "Lost Thunder",
        "Team Up",
        "Unbroken Bonds",
        "Unified Minds",
        "Cosmic Eclipse",
      ],
    },
    {
      name: "Sword & Shield Era",
      sets: [
        "Sword & Shield",
        "Rebel Clash",
        "Darkness Ablaze",
        "Vivid Voltage",
        "Battle Styles",
        "Chilling Reign",
        "Evolving Skies",
        "Fusion Strike",
        "Brilliant Stars",
        "Astral Radiance",
        "Lost Origin",
        "Silver Tempest",
        "Crown Zenith",
      ],
    },
    {
      name: "Scarlet & Violet Era",
      sets: [
        "Scarlet & Violet",
        "Paldea Evolved",
        "Obsidian Flames",
        "151",
        "Paradox Rift",
        "Paldean Fates",
        "Temporal Forces",
        "Twilight Masquerade",
        "Shrouded Fable",
        "Stellar Crown",
        "Surging Sparks",
        "Prismatic Evolutions",
        "Journey Together",
        "Destined Rivals",
        "Black Bolt",
        "White Flare",
      ],
    },
    {
      name: "Mega Evolution Era",
      sets: [
        "Mega Evolution",
        "Phantasmal Flames",
        "Ascended Heroes",
      ],
    },
  ];

  for (const s of pokemonSeries) {
    const series = await prisma.series.create({
      data: { name: s.name, categoryId: pokemon.id },
    });
    for (const setName of s.sets) {
      await prisma.cardSet.create({
        data: { name: setName, seriesId: series.id },
      });
    }
  }

  // --- App Config ---
  await prisma.appConfig.upsert({
    where: { key: "commission_rate" },
    update: {},
    create: {
      key: "commission_rate",
      value: JSON.stringify({ rate: 0.05 }), // 5% default, TBD
    },
  });

  await prisma.appConfig.upsert({
    where: { key: "minimum_deposit" },
    update: {},
    create: {
      key: "minimum_deposit",
      value: JSON.stringify({ amount: 15.0 }),
    },
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
