import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

// Test images from public/images/test-images/
const TEST_IMAGES = [
  "/images/test-images/Foto 21-01-2023 15 51 31.jpg",
  "/images/test-images/Foto 28-01-2023 13 13 59.jpg",
  "/images/test-images/Foto 02-05-2023 12 59 02.jpg",
  "/images/test-images/Foto 12-05-2023 11 31 49.jpg",
  "/images/test-images/Foto 12-05-2023 11 39 16.jpg",
  "/images/test-images/Foto 17-05-2023 10 31 58.jpg",
  "/images/test-images/Foto 27-08-2023 13 13 30.jpg",
  "/images/test-images/Foto 03-10-2023 13 51 07.jpg",
  "/images/test-images/Foto 10-12-2023 14 45 49.jpg",
  "/images/test-images/Foto 10-12-2023 14 48 39.jpg",
  "/images/test-images/Foto 10-12-2023 14 45 07.jpg",
  "/images/test-images/Foto 10-12-2023 14 47 39.jpg",
  "/images/test-images/Foto 10-12-2023 14 46 52.jpg",
  "/images/test-images/Foto 10-12-2023 14 44 25.jpg",
  "/images/test-images/Foto 10-01-2024 11 51 35.jpg",
  "/images/test-images/Foto 21-09-2024, 11 28 01.jpg",
  "/images/test-images/Foto 23-11-2024, 11 16 56.jpg",
  "/images/test-images/Foto 24-11-2024, 12 55 14.jpg",
];

function img(index: number): string {
  return TEST_IMAGES[index % TEST_IMAGES.length];
}

function imgJson(index: number, count = 1): string {
  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    urls.push(TEST_IMAGES[(index + i) % TEST_IMAGES.length]);
  }
  return JSON.stringify(urls);
}

async function main() {
  console.log("Seeding database...");

  // ===== CLEAN ALL DATA =====
  console.log("Cleaning existing data...");
  await prisma.auctionBid.deleteMany();
  await prisma.autoBid.deleteMany();
  await prisma.auctionUpsell.deleteMany();
  await prisma.auctionShippingMethod.deleteMany();
  await prisma.listingUpsell.deleteMany();
  await prisma.listingShippingMethod.deleteMany();
  await prisma.claimsaleShippingMethod.deleteMany();
  await prisma.claimsaleItem.deleteMany();
  await prisma.claimsale.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.disputeEvent.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.shippingBundle.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.usernameHistory.deleteMany();
  await prisma.verificationRequest.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.sellerShippingMethod.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();
  await prisma.cardSet.deleteMany();
  await prisma.series.deleteMany();
  await prisma.category.deleteMany();
  await prisma.appConfig.deleteMany();
  console.log("Data cleaned.");

  // ===== CATEGORIES & SETS =====
  const pokemon = await prisma.category.upsert({
    where: { slug: "pokemon" },
    update: {},
    create: { name: "Pokémon", slug: "pokemon" },
  });

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
        "Ruby & Sapphire", "Sandstorm", "Dragon", "Team Magma vs Team Aqua",
        "Hidden Legends", "FireRed & LeafGreen", "Team Rocket Returns",
        "Deoxys", "Emerald", "Unseen Forces", "Delta Species",
        "Legend Maker", "Holon Phantoms", "Crystal Guardians",
        "Dragon Frontiers", "Power Keepers",
      ],
    },
    {
      name: "Diamond & Pearl Era",
      sets: [
        "Diamond & Pearl", "Mysterious Treasures", "Secret Wonders",
        "Great Encounters", "Majestic Dawn", "Legends Awakened",
        "Stormfront", "Platinum", "Rising Rivals", "Supreme Victors", "Arceus",
      ],
    },
    {
      name: "HeartGold & SoulSilver Era",
      sets: [
        "HeartGold & SoulSilver", "Unleashed", "Undaunted",
        "Triumphant", "Call of Legends",
      ],
    },
    {
      name: "Black & White Era",
      sets: [
        "Black & White", "Emerging Powers", "Noble Victories",
        "Next Destinies", "Dark Explorers", "Dragons Exalted",
        "Boundaries Crossed", "Plasma Storm", "Plasma Freeze",
        "Plasma Blast", "Legendary Treasures",
      ],
    },
    {
      name: "XY Era",
      sets: [
        "XY", "Flashfire", "Furious Fists", "Phantom Forces",
        "Primal Clash", "Roaring Skies", "Ancient Origins",
        "BREAKthrough", "BREAKpoint", "Fates Collide",
        "Steam Siege", "Evolutions",
      ],
    },
    {
      name: "Sun & Moon Era",
      sets: [
        "Sun & Moon", "Guardians Rising", "Burning Shadows",
        "Crimson Invasion", "Ultra Prism", "Forbidden Light",
        "Celestial Storm", "Lost Thunder", "Team Up",
        "Unbroken Bonds", "Unified Minds", "Cosmic Eclipse",
      ],
    },
    {
      name: "Sword & Shield Era",
      sets: [
        "Sword & Shield", "Rebel Clash", "Darkness Ablaze",
        "Vivid Voltage", "Battle Styles", "Chilling Reign",
        "Evolving Skies", "Fusion Strike", "Brilliant Stars",
        "Astral Radiance", "Lost Origin", "Silver Tempest", "Crown Zenith",
      ],
    },
    {
      name: "Scarlet & Violet Era",
      sets: [
        "Scarlet & Violet", "Paldea Evolved", "Obsidian Flames", "151",
        "Paradox Rift", "Paldean Fates", "Temporal Forces",
        "Twilight Masquerade", "Shrouded Fable", "Stellar Crown",
        "Surging Sparks", "Prismatic Evolutions", "Journey Together",
        "Destined Rivals", "Black Bolt", "White Flare",
      ],
    },
    {
      name: "Mega Evolution Era",
      sets: ["Mega Evolution", "Phantasmal Flames", "Ascended Heroes"],
    },
  ];

  const allSets: { id: string; name: string }[] = [];
  for (const s of pokemonSeries) {
    const series = await prisma.series.create({
      data: { name: s.name, categoryId: pokemon.id },
    });
    for (const setName of s.sets) {
      const set = await prisma.cardSet.create({
        data: { name: setName, seriesId: series.id },
      });
      allSets.push(set);
    }
  }

  // ===== APP CONFIG =====
  await prisma.appConfig.upsert({
    where: { key: "commission_rate" },
    update: {},
    create: { key: "commission_rate", value: JSON.stringify({ rate: 0.05 }) },
  });
  await prisma.appConfig.upsert({
    where: { key: "minimum_deposit" },
    update: {},
    create: { key: "minimum_deposit", value: JSON.stringify({ amount: 15.0 }) },
  });

  // ===== USERS =====
  const passwordHash = await bcrypt.hash("Test1234!", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@cardscenter.nl",
      passwordHash,
      displayName: "Admin",
      accountType: "ADMIN",
      balance: 5000,
      isVerified: true,
      verificationStatus: "APPROVED",
      bankTransferReference: "admin0000000001",
      createdAt: new Date("2025-01-01"),
    },
  });

  const seller1 = await prisma.user.create({
    data: {
      email: "pikachu@test.nl",
      passwordHash,
      displayName: "PikachuTrader",
      accountType: "PRO",
      balance: 250,
      isVerified: true,
      verificationStatus: "APPROVED",
      bankTransferReference: "pikachu0000001",
      createdAt: new Date("2025-06-15"),
    },
  });

  const seller2 = await prisma.user.create({
    data: {
      email: "charizard@test.nl",
      passwordHash,
      displayName: "CharizardKing",
      accountType: "PRO",
      balance: 500,
      isVerified: true,
      verificationStatus: "APPROVED",
      bankTransferReference: "charizard00001",
      createdAt: new Date("2025-08-01"),
    },
  });

  const seller3 = await prisma.user.create({
    data: {
      email: "mewtwo@test.nl",
      passwordHash,
      displayName: "MewtwoCollector",
      accountType: "FREE",
      balance: 100,
      bankTransferReference: "mewtwo00000001",
      createdAt: new Date("2026-01-10"),
    },
  });

  const buyer = await prisma.user.create({
    data: {
      email: "koper@test.nl",
      passwordHash,
      displayName: "TestKoper",
      accountType: "FREE",
      balance: 1000,
      bankTransferReference: "testkoper00001",
      createdAt: new Date("2026-02-01"),
    },
  });

  const sellers = [seller1, seller2, seller3, admin];

  // ===== SHIPPING METHODS =====
  const shippingMethods: Record<string, { id: string }[]> = {};
  for (const seller of sellers) {
    const methods = await Promise.all([
      prisma.sellerShippingMethod.create({
        data: {
          sellerId: seller.id,
          carrier: "POSTNL",
          serviceName: "Briefpost",
          price: 1.95,
          countries: JSON.stringify(["NL"]),
        },
      }),
      prisma.sellerShippingMethod.create({
        data: {
          sellerId: seller.id,
          carrier: "POSTNL",
          serviceName: "Aangetekend",
          price: 4.5,
          countries: JSON.stringify(["NL", "BE", "DE"]),
        },
      }),
    ]);
    shippingMethods[seller.id] = methods;
  }

  // ===== Helper to pick a random set =====
  function randomSet() {
    return allSets[Math.floor(Math.random() * allSets.length)];
  }

  // ===== AUCTIONS =====
  console.log("Creating auctions...");
  const auctionData = [
    { title: "Charizard Base Set Holo 1st Edition", cardName: "Charizard", condition: "Near Mint", startingBid: 500, seller: seller1, imgIdx: 0 },
    { title: "Pikachu Illustrator Promo", cardName: "Pikachu", condition: "Lightly Played", startingBid: 1000, seller: seller2, imgIdx: 1 },
    { title: "Blastoise Base Set Holo", cardName: "Blastoise", condition: "Near Mint", startingBid: 80, seller: seller1, imgIdx: 2 },
    { title: "Umbreon VMAX Alt Art", cardName: "Umbreon VMAX", condition: "Near Mint", startingBid: 150, seller: seller3, imgIdx: 3 },
    { title: "Mew Gold Star EX Dragon Frontiers", cardName: "Mew", condition: "Excellent", startingBid: 300, seller: seller2, imgIdx: 4 },
    { title: "Lugia Neo Genesis 1st Edition", cardName: "Lugia", condition: "Lightly Played", startingBid: 200, seller: admin, imgIdx: 5 },
    { title: "Rayquaza VMAX Alt Art", cardName: "Rayquaza VMAX", condition: "Near Mint", startingBid: 120, seller: seller1, imgIdx: 6 },
    { title: "Gengar ex SAR Pokémon 151", cardName: "Gengar ex", condition: "Near Mint", startingBid: 45, seller: seller3, imgIdx: 7 },
    { title: "Mewtwo GX Rainbow Rare", cardName: "Mewtwo GX", condition: "Near Mint", startingBid: 30, seller: seller2, imgIdx: 8 },
    { title: "Eevee Heroes Booster Box Sealed", cardName: null, condition: null, startingBid: 250, seller: admin, imgIdx: 9, type: "SEALED_PRODUCT", productType: "Booster Box" },
    { title: "Evolving Skies Complete Master Set", cardName: null, condition: null, startingBid: 400, seller: seller1, imgIdx: 10, type: "COLLECTION", estimatedCardCount: 237 },
    { title: "Giratina VSTAR Alt Art", cardName: "Giratina VSTAR", condition: "Near Mint", startingBid: 90, seller: seller2, imgIdx: 11 },
  ];

  for (const a of auctionData) {
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + (Math.random() > 0.5 ? 7 : 5));
    const set = randomSet();

    const auction = await prisma.auction.create({
      data: {
        title: a.title,
        auctionType: a.type || "SINGLE_CARD",
        cardName: a.cardName,
        cardSetId: a.cardName ? set.id : null,
        condition: a.condition,
        productType: (a as any).productType || null,
        estimatedCardCount: (a as any).estimatedCardCount || null,
        startingBid: a.startingBid,
        duration: Math.random() > 0.5 ? 7 : 5,
        endTime,
        sellerId: a.seller.id,
        imageUrls: imgJson(a.imgIdx, 3),
        description: `Mooie ${a.title} in uitstekende staat. Bekijk de foto's voor de exacte conditie.`,
        status: "ACTIVE",
      },
    });

    // Link shipping methods
    const methods = shippingMethods[a.seller.id];
    for (const method of methods) {
      await prisma.auctionShippingMethod.create({
        data: {
          auctionId: auction.id,
          shippingMethodId: method.id,
          price: method.id === methods[0].id ? 1.95 : 4.5,
        },
      });
    }
  }

  // ===== LISTINGS =====
  console.log("Creating listings...");
  const listingData = [
    { title: "Pikachu VMAX Rainbow Rare", cardName: "Pikachu VMAX", condition: "Near Mint", price: 35, seller: seller1, imgIdx: 12 },
    { title: "Arceus VSTAR Gold", cardName: "Arceus VSTAR", condition: "Near Mint", price: 25, seller: seller2, imgIdx: 13 },
    { title: "Charizard UPC Promo", cardName: "Charizard", condition: "Near Mint", price: 60, seller: seller1, imgIdx: 14 },
    { title: "Moonbreon Alt Art Proxy", cardName: "Umbreon VMAX", condition: "Lightly Played", price: 180, seller: seller3, imgIdx: 15 },
    { title: "Scarlet & Violet ETB Sealed", cardName: null, condition: null, price: 45, seller: admin, imgIdx: 16, type: "SEALED_PRODUCT", productType: "Elite Trainer Box" },
    { title: "Japanese Vaporeon VMAX SA", cardName: "Vaporeon VMAX", condition: "Near Mint", price: 70, seller: seller2, imgIdx: 17 },
    { title: "Paldea Evolved Booster Bundle", cardName: null, condition: null, price: 30, seller: seller1, imgIdx: 0, type: "SEALED_PRODUCT", productType: "Booster Bundle" },
    { title: "Miraidon ex Special Art Rare", cardName: "Miraidon ex", condition: "Near Mint", price: 22, seller: seller3, imgIdx: 1 },
    { title: "Lot 50x Holographic Cards", cardName: null, condition: null, price: 15, seller: seller2, imgIdx: 2, type: "COLLECTION", estimatedCardCount: 50 },
    { title: "Mew VMAX Alt Art Lost Origin", cardName: "Mew VMAX", condition: "Near Mint", price: 55, seller: admin, imgIdx: 3 },
    { title: "Lechonk AR Obsidian Flames", cardName: "Lechonk", condition: "Near Mint", price: 5, seller: seller1, imgIdx: 4 },
    { title: "Gardevoir ex SAR 151", cardName: "Gardevoir ex", condition: "Near Mint", price: 40, seller: seller2, imgIdx: 5 },
  ];

  for (const l of listingData) {
    const set = randomSet();

    const listing = await prisma.listing.create({
      data: {
        title: l.title,
        description: `Te koop: ${l.title}. Kaart is in perfecte staat, zie foto's. Verzending via PostNL.`,
        listingType: l.type || "SINGLE_CARD",
        cardName: l.cardName,
        cardSetId: l.cardName ? set.id : null,
        condition: l.condition,
        productType: (l as any).productType || null,
        estimatedCardCount: (l as any).estimatedCardCount || null,
        price: l.price,
        pricingType: "FIXED",
        imageUrls: imgJson(l.imgIdx, 2),
        sellerId: l.seller.id,
        status: "ACTIVE",
        shippingCost: 1.95,
      },
    });

    const methods = shippingMethods[l.seller.id];
    for (const method of methods) {
      await prisma.listingShippingMethod.create({
        data: {
          listingId: listing.id,
          shippingMethodId: method.id,
          price: method.id === methods[0].id ? 1.95 : 4.5,
        },
      });
    }
  }

  // ===== CLAIMSALES =====
  console.log("Creating claimsales...");
  const claimsaleData = [
    {
      title: "Base Set Lot - 20 kaarten",
      seller: seller1,
      coverIdx: 6,
      items: [
        { cardName: "Bulbasaur", condition: "Lightly Played", price: 3, ref: "#44", imgIdx: 6 },
        { cardName: "Charmander", condition: "Near Mint", price: 5, ref: "#46", imgIdx: 7 },
        { cardName: "Squirtle", condition: "Near Mint", price: 4, ref: "#63", imgIdx: 8 },
        { cardName: "Pikachu", condition: "Excellent", price: 8, ref: "#58", imgIdx: 9 },
        { cardName: "Nidoran", condition: "Lightly Played", price: 2, ref: "#55", imgIdx: 10 },
      ],
    },
    {
      title: "Modern Hits Claimsale",
      seller: seller2,
      coverIdx: 11,
      items: [
        { cardName: "Charizard ex", condition: "Near Mint", price: 15, ref: "SV3-199", imgIdx: 11 },
        { cardName: "Mewtwo VSTAR", condition: "Near Mint", price: 8, ref: "CZ-GG44", imgIdx: 12 },
        { cardName: "Lugia VSTAR", condition: "Near Mint", price: 20, ref: "SIT-186", imgIdx: 13 },
        { cardName: "Giratina V Alt", condition: "Excellent", price: 45, ref: "LOR-130", imgIdx: 14 },
      ],
    },
    {
      title: "Japanese Promos Lot",
      seller: admin,
      coverIdx: 15,
      items: [
        { cardName: "Pikachu Promo", condition: "Near Mint", price: 12, ref: "PROMO-001", imgIdx: 15 },
        { cardName: "Eevee Promo", condition: "Near Mint", price: 10, ref: "PROMO-002", imgIdx: 16 },
        { cardName: "Mew Promo", condition: "Lightly Played", price: 18, ref: "PROMO-003", imgIdx: 17 },
      ],
    },
    {
      title: "Evolving Skies Hits",
      seller: seller3,
      coverIdx: 0,
      items: [
        { cardName: "Rayquaza VMAX", condition: "Near Mint", price: 55, ref: "EVS-218", imgIdx: 0 },
        { cardName: "Umbreon VMAX", condition: "Near Mint", price: 95, ref: "EVS-215", imgIdx: 1 },
        { cardName: "Dragonite V Alt", condition: "Near Mint", price: 30, ref: "EVS-192", imgIdx: 2 },
        { cardName: "Sylveon VMAX", condition: "Excellent", price: 25, ref: "EVS-212", imgIdx: 3 },
        { cardName: "Glaceon VMAX", condition: "Near Mint", price: 20, ref: "EVS-209", imgIdx: 4 },
        { cardName: "Leafeon VMAX", condition: "Near Mint", price: 18, ref: "EVS-205", imgIdx: 5 },
      ],
    },
  ];

  for (const cs of claimsaleData) {
    const claimsale = await prisma.claimsale.create({
      data: {
        title: cs.title,
        description: `Claimsale: ${cs.title}. Claim individuele kaarten, op is op!`,
        coverImage: img(cs.coverIdx),
        sellerId: cs.seller.id,
        shippingCost: 1.95,
        status: "LIVE",
        publishedAt: new Date(),
      },
    });

    const set = randomSet();
    for (const item of cs.items) {
      await prisma.claimsaleItem.create({
        data: {
          cardName: item.cardName,
          condition: item.condition,
          price: item.price,
          reference: item.ref,
          imageUrls: imgJson(item.imgIdx, 2),
          cardSetId: set.id,
          claimsaleId: claimsale.id,
          status: "AVAILABLE",
        },
      });
    }

    const methods = shippingMethods[cs.seller.id];
    for (const method of methods) {
      await prisma.claimsaleShippingMethod.create({
        data: {
          claimsaleId: claimsale.id,
          shippingMethodId: method.id,
          price: method.id === methods[0].id ? 1.95 : 4.5,
        },
      });
    }
  }

  // ===== SOME REVIEWS for seller levels =====
  console.log("Creating reviews...");
  await prisma.review.create({
    data: { reviewerId: buyer.id, sellerId: seller1.id, rating: 5, comment: "Snelle verzending, mooie kaart!" },
  });
  await prisma.review.create({
    data: { reviewerId: buyer.id, sellerId: seller2.id, rating: 4, comment: "Goed verpakt, aanrader." },
  });

  console.log("Seeding complete!");
  console.log("Test accounts (wachtwoord: Test1234!):");
  console.log("  admin@cardscenter.nl (Admin)");
  console.log("  pikachu@test.nl (PikachuTrader - PRO)");
  console.log("  charizard@test.nl (CharizardKing - PRO)");
  console.log("  mewtwo@test.nl (MewtwoCollector - FREE)");
  console.log("  koper@test.nl (TestKoper - buyer)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
