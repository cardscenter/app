import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔥 Seeding cosmetic bundles & lootboxes...");

  // ============================================================
  // BUNDLE 1: Customization Bundle 1
  // ============================================================

  const bundle1 = await prisma.cosmeticBundle.upsert({
    where: { key: "customization-bundle-1" },
    update: {
      name: "Fan-Art: Origins",
      description: "De eerste collectie fan-art banners, emblems en achtergronden voor je profiel",
      isActive: true,
      sortOrder: 1,
    },
    create: {
      key: "customization-bundle-1",
      name: "Fan-Art: Origins",
      description: "De eerste collectie fan-art banners, emblems en achtergronden voor je profiel",
      isActive: true,
      sortOrder: 1,
    },
  });

  console.log(`  ✅ Bundle: ${bundle1.name} (${bundle1.id})`);

  // --- BANNERS ---
  const basePath = "/images/cosmetics/banners/fan-art-origins";

  const banners = [
    // UNCOMMON (12)
    { key: "chikorita-rest-banner", name: "Chikorita's Rest", rarity: "UNCOMMON", weight: 100, artistKey: "sanne-bakker", assetPath: `${basePath}/uncommon/A_Chikorita_sitting_on_a_woode_Nano_Banana_2_66745.jpg` },
    { key: "clefairy-dance-banner", name: "Clefairy Dance", rarity: "UNCOMMON", weight: 100, artistKey: "luuk-de-vries", assetPath: `${basePath}/uncommon/A_Clefairy_dancing_alone_in_a__Nano_Banana_2_88175.jpg` },
    { key: "jigglypuff-stage-banner", name: "Jigglypuff Performance", rarity: "UNCOMMON", weight: 100, artistKey: "camille-dubois", assetPath: `${basePath}/uncommon/A_Jigglypuff_performing_on_a_t_Nano_Banana_2_55003.jpg` },
    { key: "meganium-meadow-banner", name: "Peaceful Meganium", rarity: "UNCOMMON", weight: 100, artistKey: "felix-wagner", assetPath: `${basePath}/uncommon/A_Meganium_grazing_peacefully__Nano_Banana_2_43751.jpg` },
    { key: "meowth-coins-banner", name: "Meowth's Coins", rarity: "UNCOMMON", weight: 100, artistKey: "marco-rossi", assetPath: `${basePath}/uncommon/A_Meowth_counting_a_small_pile_Nano_Banana_2_63537.jpg` },
    { key: "pikachu-sleep-banner", name: "Sleeping Pikachu", rarity: "UNCOMMON", weight: 100, artistKey: "pablo-ruiz", assetPath: `${basePath}/uncommon/A_Pikachu_asleep_inside_a_cere_Nano_Banana_2_42205.jpg` },
    { key: "pikachu-rain-banner", name: "Rainy Pikachu", rarity: "UNCOMMON", weight: 100, artistKey: "oliver-jensen", assetPath: `${basePath}/uncommon/A_Pikachu_standing_in_the_rain_Nano_Banana_2_30205.jpg` },
    { key: "snubbull-lonely-banner", name: "Lonely Snubbull", rarity: "UNCOMMON", weight: 100, artistKey: "kacper-nowak", assetPath: `${basePath}/uncommon/A_Snubbull_sitting_alone_on_a__Nano_Banana_2_14852.jpg` },
    { key: "sudowoodo-banner", name: "Awkward Sudowoodo", rarity: "UNCOMMON", weight: 100, artistKey: "elina-virtanen", assetPath: `${basePath}/uncommon/A_Sudowoodo_standing_awkwardly_Nano_Banana_2_89851.jpg` },
    { key: "tangela-rolling-banner", name: "Rolling Tangela", rarity: "UNCOMMON", weight: 100, artistKey: "diogo-silva", assetPath: `${basePath}/uncommon/A_Tangela_slowly_rolling_down__Nano_Banana_2_68977.jpg` },
    { key: "tropius-walk-banner", name: "Tropius Walk", rarity: "UNCOMMON", weight: 100, artistKey: "emile-claes", assetPath: `${basePath}/uncommon/A_Tropius_walking_slowly_throu_Nano_Banana_2_47666.jpg` },
    { key: "turtwig-edge-banner", name: "Turtwig at the Edge", rarity: "UNCOMMON", weight: 100, artistKey: "hannah-steiner", assetPath: `${basePath}/uncommon/A_Turtwig_sitting_at_the_edge__Nano_Banana_2_20081.jpg` },

    // RARE (6)
    { key: "suicune-lake-banner", name: "Suicune at the Lake", rarity: "RARE", weight: 100, artistKey: "theo-moreau", assetPath: `${basePath}/rare/A_Suicune_standing_at_the_edge_Nano_Banana_2_40871.jpg` },
    { key: "misty-dawn-banner", name: "Misty Mountain Dawn", rarity: "RARE", weight: 100, artistKey: "astrid-lindqvist", assetPath: `${basePath}/rare/A_misty_mountain_lake_at_dawn__Nano_Banana_2_60060.jpg` },
    { key: "snowy-night-banner", name: "Snowy Night", rarity: "RARE", weight: 100, artistKey: "jakub-dvorak", assetPath: `${basePath}/rare/A_quiet_snowfield_at_night_und_Nano_Banana_2_08271.jpg` },
    { key: "umbreon-sleep-banner", name: "Sleeping Umbreon", rarity: "RARE", weight: 100, artistKey: "lena-krueger", assetPath: `${basePath}/rare/An_Umbreon_curled_up_asleep_on_Nano_Banana_2_36759.jpg` },
    { key: "umbreon-alone-banner", name: "Lone Umbreon", rarity: "RARE", weight: 100, artistKey: "lena-krueger", assetPath: `${basePath}/rare/An_Umbreon_sitting_alone_on_a__Nano_Banana_2_01301.jpg` },
    { key: "umbreon-forest-banner", name: "Silent Umbreon", rarity: "RARE", weight: 100, artistKey: "lena-krueger", assetPath: `${basePath}/rare/An_Umbreon_walking_silently_th_Nano_Banana_2_52716.jpg` },
    { key: "totodile-splash-banner", name: "Totodile's Golden Splash", rarity: "RARE", weight: 100, artistKey: "sanne-bakker", assetPath: `${basePath}/rare/Totodile_lake.png` },

    // EPIC (5)
    { key: "dark-cathedral-banner", name: "Dark Cathedral", rarity: "EPIC", weight: 100, artistKey: "giulia-bianchi", assetPath: `${basePath}/epic/A_dark_cathedral_of_ancient_st_Nano_Banana_2_04227.jpg` },
    { key: "haunted-forest-banner", name: "Haunted Forest", rarity: "EPIC", weight: 100, artistKey: "lucia-fernandez", assetPath: `${basePath}/epic/A_dense_haunted_forest_at_midn_Nano_Banana_2_37963.jpg` },
    { key: "flygon-skies-banner", name: "Flygon Skies", rarity: "EPIC", weight: 100, artistKey: "camille-dubois", assetPath: `${basePath}/epic/A_Flygon_soaring_high_above_a__Nano_Banana_2_52639.jpg` },
    { key: "lucario-cliff-banner", name: "Lucario's Resolve", rarity: "EPIC", weight: 100, artistKey: "felix-wagner", assetPath: `${basePath}/epic/A_Lucario_standing_on_a_cliff__Nano_Banana_2_37846.jpg` },
    { key: "nido-royals-banner", name: "Nido Royals", rarity: "EPIC", weight: 100, artistKey: "marco-rossi", assetPath: `${basePath}/epic/A_Nidoking_and_Nidoqueen_stand_Nano_Banana_2_70587.jpg` },

    // LEGENDARY (6)
    { key: "breath-of-legend-banner", name: "Breath of Legend", rarity: "LEGENDARY", weight: 100, artistKey: "theo-moreau", assetPath: `${basePath}/legendary/create_a_variant_banner_A_brea_Nano_Banana_2_89194.jpg` },
    { key: "hooh-harvest-banner", name: "Ho-Oh's Harvest", rarity: "LEGENDARY", weight: 100, artistKey: "camille-dubois", assetPath: `${basePath}/legendary/Ho-Oh_wheat.png` },
    { key: "kyogre-abyss-banner", name: "Kyogre's Abyss", rarity: "LEGENDARY", weight: 100, artistKey: "giulia-bianchi", assetPath: `${basePath}/legendary/Kyogre_deep.png` },
    { key: "lugia-tempest-banner", name: "Lugia's Tempest", rarity: "LEGENDARY", weight: 100, artistKey: "theo-moreau", assetPath: `${basePath}/legendary/Lugia_storm.png` },
    { key: "mew-blossom-banner", name: "Mew's Blossom Grove", rarity: "LEGENDARY", weight: 100, artistKey: "astrid-lindqvist", assetPath: `${basePath}/legendary/Mew_forest.png` },
    { key: "regice-sanctum-banner", name: "Regice's Crystal Sanctum", rarity: "LEGENDARY", weight: 100, artistKey: "felix-wagner", assetPath: `${basePath}/legendary/Regice_golden_cave.png` },

    // UNIQUE (4)
    { key: "rayquaza-descends-banner", name: "Rayquaza Descends", rarity: "UNIQUE", weight: 100, artistKey: "giulia-bianchi", assetPath: `${basePath}/unique/A_colossal_Rayquaza_descends_f_Nano_Banana_2_28928.jpg` },
    { key: "mystic-vision-banner", name: "Mystic Vision", rarity: "UNIQUE", weight: 100, artistKey: "astrid-lindqvist", assetPath: `${basePath}/unique/Here_is_the_full_English_promp_Nano_Banana_2_66436.jpg` },
    { key: "suicune-charge-banner", name: "Charging Suicune", rarity: "UNIQUE", weight: 100, artistKey: "pablo-ruiz", assetPath: `${basePath}/unique/Suicune_charging_at_full_speed_Nano_Banana_2_83844.jpg` },
    { key: "torn-sky-banner", name: "Torn Sky", rarity: "UNIQUE", weight: 100, artistKey: "luuk-de-vries", assetPath: `${basePath}/unique/The_sky_is_tearing_open_above__Nano_Banana_2_14325.jpg` },

    // SHINY (1) — ultra rare
    { key: "shiny-legendary-banner", name: "Shiny Ascension", rarity: "SHINY", weight: 100, artistKey: "sanne-bakker", assetPath: `${basePath}/shiny/great_but_now_without_the_glow_Nano_Banana_2_17689.jpg` },
  ];

  // --- EMBLEMS ---
  const emblemBasePath = "/images/cosmetics/emblems/fan-art-origins";

  const emblems = [
    { key: "pokeball-default-emblem", name: "Pokéball Classic", rarity: "UNCOMMON", weight: 100, artistKey: "kacper-nowak", assetPath: `${emblemBasePath}/uncommon/pokeball_default.png`, isDefault: true },
    { key: "eevee-canvas-emblem", name: "Eevee's Autumn Canvas", rarity: "EPIC", weight: 100, artistKey: "emile-claes", assetPath: `${emblemBasePath}/epic/eevee_canvas.png` },
    { key: "togepi-garden-emblem", name: "Togepi's Garden", rarity: "LEGENDARY", weight: 100, artistKey: "jakub-dvorak", assetPath: `${emblemBasePath}/legendary/togepi.png` },
    { key: "xerneas-grove-emblem", name: "Xerneas' Enchanted Grove", rarity: "UNIQUE", weight: 100, artistKey: "elina-virtanen", assetPath: `${emblemBasePath}/unique/xerneas.png` },
  ];

  // --- BACKGROUNDS ---
  const bgBasePath = "/images/cosmetics/backgrounds/fan-art-origins";

  const backgrounds = [
    // UNCOMMON (3)
    { key: "enchanted-path-bg", name: "Enchanted Path", rarity: "UNCOMMON", weight: 100, artistKey: "lucia-fernandez", assetPath: `${bgBasePath}/uncommon/beautiful_forest.png` },
    { key: "autumn-village-bg", name: "Autumn Village", rarity: "UNCOMMON", weight: 100, artistKey: "sanne-bakker", assetPath: `${bgBasePath}/uncommon/cozy_town.png` },
    { key: "wildflower-river-bg", name: "Wildflower River", rarity: "UNCOMMON", weight: 100, artistKey: "marco-rossi", assetPath: `${bgBasePath}/uncommon/happy_lake.png` },

    // RARE (3)
    { key: "heracross-falls-bg", name: "Heracross Falls", rarity: "RARE", weight: 100, artistKey: "hannah-steiner", assetPath: `${bgBasePath}/rare/heracross_jungle.png` },
    { key: "snorunt-winter-bg", name: "Snorunt's Winter Night", rarity: "RARE", weight: 100, artistKey: "jakub-dvorak", assetPath: `${bgBasePath}/rare/snorunt_village.png` },
    { key: "wailord-storm-bg", name: "Wailord's Fury", rarity: "RARE", weight: 100, artistKey: "theo-moreau", assetPath: `${bgBasePath}/rare/wailord_storm.png` },

    // EPIC (3)
    { key: "charizard-eruption-bg", name: "Charizard's Eruption", rarity: "EPIC", weight: 100, artistKey: "giulia-bianchi", assetPath: `${bgBasePath}/epic/charizard_volcano.png` },
    { key: "flygon-stardust-bg", name: "Flygon's Stardust", rarity: "EPIC", weight: 100, artistKey: "astrid-lindqvist", assetPath: `${bgBasePath}/epic/flygon_nebula.png` },
    { key: "glaceon-glacier-bg", name: "Glaceon's Frontier", rarity: "EPIC", weight: 100, artistKey: "lena-krueger", assetPath: `${bgBasePath}/epic/glaceon_glacier.png` },

    // LEGENDARY (1)
    { key: "gengar-shadow-bg", name: "Gengar's Shadow Realm", rarity: "LEGENDARY", weight: 100, artistKey: "felix-wagner", assetPath: `${bgBasePath}/legendary/gengar_oil.png` },
  ];

  // --- XP REWARDS ---
  const xpRewards = [
    { key: "xp-small", name: "+10 XP", rarity: "UNCOMMON", type: "XP_REWARD" as const, rewardValue: 10, weight: 150 },
    { key: "xp-medium", name: "+25 XP", rarity: "RARE", type: "XP_REWARD" as const, rewardValue: 25, weight: 100 },
    { key: "xp-large", name: "+50 XP", rarity: "EPIC", type: "XP_REWARD" as const, rewardValue: 50, weight: 80 },
  ];

  // --- EMBER REWARDS (only Epic+, meaningful amounts) ---
  const emberRewards = [
    { key: "ember-jackpot-epic", name: "+500 Ember", rarity: "EPIC", type: "EMBER_REWARD" as const, rewardValue: 500, weight: 80 },
    { key: "ember-jackpot-legendary", name: "+1.000 Ember", rarity: "LEGENDARY", type: "EMBER_REWARD" as const, rewardValue: 1000, weight: 80 },
    { key: "ember-jackpot-unique", name: "+1.500 Ember", rarity: "UNIQUE", type: "EMBER_REWARD" as const, rewardValue: 1500, weight: 80 },
  ];

  // Upsert all items (update existing, create new — never deletes)
  const allItems = [
    ...banners.map((b) => ({ ...b, type: "BANNER" as const, rewardValue: null as number | null })),
    ...emblems.map((e) => ({ ...e, type: "EMBLEM" as const, rewardValue: null as number | null, assetPath: ("assetPath" in e ? e.assetPath : null) as string | null })),
    ...backgrounds.map((bg) => ({ ...bg, type: "BACKGROUND" as const, rewardValue: null as number | null, assetPath: ("assetPath" in bg ? bg.assetPath : null) as string | null })),
    ...xpRewards.map((x) => ({ ...x, assetPath: null as string | null, artistKey: null as string | null })),
    ...emberRewards.map((e) => ({ ...e, assetPath: null as string | null, artistKey: null as string | null })),
  ];

  let created = 0;
  let updated = 0;
  const createdItems = [];

  for (const item of allItems) {
    const existing = await prisma.cosmeticItem.findUnique({ where: { key: item.key } });
    if (existing) {
      await prisma.cosmeticItem.update({
        where: { key: item.key },
        data: {
          name: item.name,
          rarity: item.rarity,
          assetPath: item.assetPath,
          weight: item.weight,
          rewardValue: item.rewardValue,
          artistKey: item.artistKey,
          bundleId: bundle1.id,
        },
      });
      createdItems.push(existing);
      updated++;
    } else {
      const newItem = await prisma.cosmeticItem.create({
        data: {
          key: item.key,
          type: item.type,
          name: item.name,
          rarity: item.rarity,
          bundleId: bundle1.id,
          assetPath: item.assetPath,
          rewardValue: item.rewardValue,
          weight: item.weight,
          artistKey: item.artistKey,
        },
      });
      createdItems.push(newItem);
      created++;
    }
  }

  console.log(`  ✅ Items: ${created} nieuw, ${updated} bijgewerkt`);

  // ============================================================
  // LOOTBOXES
  // ============================================================

  const lootboxCover = "/images/cosmetics/lootboxes/series1.png";

  // Standard: Shiny = 25/10025 ≈ 0.25% (1 in 400)
  const standardPack = await prisma.lootbox.upsert({
    where: { key: "bundle-1-standard" },
    update: {
      name: "Standaard Pack",
      description: "Een standaard pack met items uit Customization Bundle 1",
      imageUrl: lootboxCover,
      emberCost: 150,
      weightUncommon: 5000,
      weightRare: 3000,
      weightEpic: 1500,
      weightLegendary: 450,
      weightUnique: 50,
      weightShiny: 25,
    },
    create: {
      key: "bundle-1-standard",
      name: "Standaard Pack",
      description: "Een standaard pack met items uit Customization Bundle 1",
      imageUrl: lootboxCover,
      emberCost: 150,
      bundleId: bundle1.id,
      isActive: true,
      weightUncommon: 5000,
      weightRare: 3000,
      weightEpic: 1500,
      weightLegendary: 450,
      weightUnique: 50,
      weightShiny: 25,
    },
  });

  console.log(`  ✅ Lootbox: ${standardPack.name} (${standardPack.emberCost} Ember)`);

  // Premium: Shiny = 75/10075 ≈ 0.74% (1 in 135)
  const premiumPack = await prisma.lootbox.upsert({
    where: { key: "bundle-1-premium" },
    update: {
      name: "Premium Pack",
      description: "Betere kansen op zeldzame items uit Customization Bundle 1",
      imageUrl: lootboxCover,
      emberCost: 400,
      weightUncommon: 3000,
      weightRare: 3000,
      weightEpic: 2500,
      weightLegendary: 1200,
      weightUnique: 300,
      weightShiny: 75,
    },
    create: {
      key: "bundle-1-premium",
      name: "Premium Pack",
      description: "Betere kansen op zeldzame items uit Customization Bundle 1",
      imageUrl: lootboxCover,
      emberCost: 400,
      bundleId: bundle1.id,
      isActive: true,
      weightUncommon: 3000,
      weightRare: 3000,
      weightEpic: 2500,
      weightLegendary: 1200,
      weightUnique: 300,
      weightShiny: 75,
    },
  });

  console.log(`  ✅ Lootbox: ${premiumPack.name} (${premiumPack.emberCost} Ember)`);

  // Link all items to both lootboxes (skip existing links)
  let newLinks = 0;
  for (const item of createdItems) {
    for (const lootbox of [standardPack, premiumPack]) {
      const existing = await prisma.lootboxItem.findUnique({
        where: { lootboxId_itemId: { lootboxId: lootbox.id, itemId: item.id } },
      });
      if (!existing) {
        await prisma.lootboxItem.create({
          data: { lootboxId: lootbox.id, itemId: item.id },
        });
        newLinks++;
      }
    }
  }

  console.log(`  ✅ ${newLinks} nieuwe lootbox-item links`);

  // ============================================================
  // EMBER — alleen voor users die nog 0 hebben
  // ============================================================

  const usersWithoutEmber = await prisma.user.findMany({
    where: { emberBalance: 0 },
    take: 10,
    select: { id: true, displayName: true },
  });

  for (const user of usersWithoutEmber) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emberBalance: 1000 },
    });
    console.log(`  🔥 ${user.displayName}: 1000 Ember (was 0)`);
  }

  if (usersWithoutEmber.length === 0) {
    console.log("  ℹ️  Alle users hebben al Ember — geen balances gewijzigd");
  }

  // ============================================================
  // DEFAULT EMBLEM — give all users the Pokéball Classic emblem
  // ============================================================

  const defaultEmblem = await prisma.cosmeticItem.findUnique({
    where: { key: "pokeball-default-emblem" },
  });

  if (defaultEmblem) {
    const allUsers = await prisma.user.findMany({
      select: { id: true, displayName: true, profileEmblem: true },
    });

    let emblemGranted = 0;
    for (const user of allUsers) {
      // Grant ownership if not already owned
      const alreadyOwned = await prisma.ownedItem.findFirst({
        where: { userId: user.id, itemId: defaultEmblem.id },
      });
      if (!alreadyOwned) {
        await prisma.ownedItem.create({
          data: { userId: user.id, itemId: defaultEmblem.id, source: "DEFAULT" },
        });
      }

      // Equip as default if no emblem set
      if (!user.profileEmblem) {
        await prisma.user.update({
          where: { id: user.id },
          data: { profileEmblem: "pokeball-default-emblem" },
        });
        emblemGranted++;
      }
    }
    console.log(`  🛡️ Default emblem: ${emblemGranted} users equipped, ${allUsers.length} users own it`);
  }

  // ============================================================
  // SUMMARY
  // ============================================================

  const totalItems = await prisma.cosmeticItem.count();
  const totalLootboxes = await prisma.lootbox.count();
  const totalBundles = await prisma.cosmeticBundle.count();

  console.log("\n📊 Samenvatting:");
  console.log(`   Bundles: ${totalBundles}`);
  console.log(`   Items: ${totalItems} (${banners.length} banners, ${emblems.length} emblems, ${backgrounds.length} backgrounds, ${xpRewards.length} XP, ${emberRewards.length} Ember)`);
  console.log(`   Lootboxes: ${totalLootboxes}`);
  console.log("\n✅ Cosmetic seeding voltooid!");
}

main()
  .catch((e) => {
    console.error("❌ Seed fout:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
