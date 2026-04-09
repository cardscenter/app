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

// All EU country codes (minus GB, CH, NO)
const ALL_EU = ["NL","BE","DE","FR","AT","IT","ES","PT","LU","IE","DK","SE","FI","PL","CZ","SK","HU","RO","BG","HR","SI","EE","LV","LT","GR","MT","CY"];
const EU_EXCEPT_NL = ALL_EU.filter(c => c !== "NL");

async function createDefaultShippingMethods(sellerId: string, country: string) {
  if (country === "NL") {
    return Promise.all([
      prisma.sellerShippingMethod.create({
        data: { sellerId, carrier: "POSTNL", serviceName: "Briefpost", price: 1.69, countries: JSON.stringify(["NL"]), shippingType: "LETTER", isDefault: true, isTracked: false, isSigned: false },
      }),
      prisma.sellerShippingMethod.create({
        data: { sellerId, carrier: "POSTNL", serviceName: "Brievenbuspakket", price: 4.85, countries: JSON.stringify(["NL"]), shippingType: "MAILBOX_PARCEL", isDefault: true, isTracked: true, isSigned: false },
      }),
      prisma.sellerShippingMethod.create({
        data: { sellerId, carrier: "POSTNL", serviceName: "Aangetekend pakket", price: 10.45, countries: JSON.stringify(["NL"]), shippingType: "PARCEL", isDefault: true, isTracked: true, isSigned: true },
      }),
      prisma.sellerShippingMethod.create({
        data: { sellerId, carrier: "POSTNL", serviceName: "EU Briefpost", price: 4.50, countries: JSON.stringify(EU_EXCEPT_NL), shippingType: "LETTER", isDefault: true, isTracked: false, isSigned: false },
      }),
      prisma.sellerShippingMethod.create({
        data: { sellerId, carrier: "POSTNL", serviceName: "EU Pakket aangetekend", price: 15.50, countries: JSON.stringify(EU_EXCEPT_NL), shippingType: "PARCEL", isDefault: true, isTracked: true, isSigned: true },
      }),
    ]);
  }
  if (country === "BE") {
    return Promise.all([
      prisma.sellerShippingMethod.create({
        data: { sellerId, carrier: "BPOST", serviceName: "Standaard Pakket", price: 5.50, countries: JSON.stringify(ALL_EU), shippingType: "PARCEL", isDefault: true, isTracked: true, isSigned: false },
      }),
      prisma.sellerShippingMethod.create({
        data: { sellerId, carrier: "BPOST", serviceName: "Aangetekend Pakket", price: 9.80, countries: JSON.stringify(ALL_EU), shippingType: "PARCEL", isDefault: true, isTracked: true, isSigned: true },
      }),
    ]);
  }
  return Promise.all([
    prisma.sellerShippingMethod.create({
      data: { sellerId, carrier: "OTHER", serviceName: "Standaard Verzending", price: 5.00, countries: JSON.stringify(ALL_EU), shippingType: "PARCEL", isDefault: true, isTracked: true, isSigned: false },
    }),
    prisma.sellerShippingMethod.create({
      data: { sellerId, carrier: "OTHER", serviceName: "Aangetekende Verzending", price: 12.00, countries: JSON.stringify(ALL_EU), shippingType: "PARCEL", isDefault: true, isTracked: true, isSigned: true },
    }),
  ]);
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
    { name: "Base Set Era", sets: ["Base Set", "Jungle", "Fossil", "Base Set 2", "Team Rocket"] },
    { name: "Neo Era", sets: ["Neo Genesis", "Neo Discovery", "Neo Revelation", "Neo Destiny"] },
    { name: "e-Card Era", sets: ["Expedition Base Set", "Aquapolis", "Skyridge"] },
    { name: "EX Era", sets: ["Ruby & Sapphire", "Sandstorm", "Dragon", "Team Magma vs Team Aqua", "Hidden Legends", "FireRed & LeafGreen", "Team Rocket Returns", "Deoxys", "Emerald", "Unseen Forces", "Delta Species", "Legend Maker", "Holon Phantoms", "Crystal Guardians", "Dragon Frontiers", "Power Keepers"] },
    { name: "Diamond & Pearl Era", sets: ["Diamond & Pearl", "Mysterious Treasures", "Secret Wonders", "Great Encounters", "Majestic Dawn", "Legends Awakened", "Stormfront", "Platinum", "Rising Rivals", "Supreme Victors", "Arceus"] },
    { name: "HeartGold & SoulSilver Era", sets: ["HeartGold & SoulSilver", "Unleashed", "Undaunted", "Triumphant", "Call of Legends"] },
    { name: "Black & White Era", sets: ["Black & White", "Emerging Powers", "Noble Victories", "Next Destinies", "Dark Explorers", "Dragons Exalted", "Boundaries Crossed", "Plasma Storm", "Plasma Freeze", "Plasma Blast", "Legendary Treasures"] },
    { name: "XY Era", sets: ["XY", "Flashfire", "Furious Fists", "Phantom Forces", "Primal Clash", "Roaring Skies", "Ancient Origins", "BREAKthrough", "BREAKpoint", "Fates Collide", "Steam Siege", "Evolutions"] },
    { name: "Sun & Moon Era", sets: ["Sun & Moon", "Guardians Rising", "Burning Shadows", "Crimson Invasion", "Ultra Prism", "Forbidden Light", "Celestial Storm", "Lost Thunder", "Team Up", "Unbroken Bonds", "Unified Minds", "Cosmic Eclipse"] },
    { name: "Sword & Shield Era", sets: ["Sword & Shield", "Rebel Clash", "Darkness Ablaze", "Vivid Voltage", "Battle Styles", "Chilling Reign", "Evolving Skies", "Fusion Strike", "Brilliant Stars", "Astral Radiance", "Lost Origin", "Silver Tempest", "Crown Zenith"] },
    { name: "Scarlet & Violet Era", sets: ["Scarlet & Violet", "Paldea Evolved", "Obsidian Flames", "151", "Paradox Rift", "Paldean Fates", "Temporal Forces", "Twilight Masquerade", "Shrouded Fable", "Stellar Crown", "Surging Sparks", "Prismatic Evolutions", "Journey Together", "Destined Rivals", "Black Bolt", "White Flare"] },
    { name: "Mega Evolution Era", sets: ["Mega Evolution", "Phantasmal Flames", "Ascended Heroes"] },
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
  await prisma.appConfig.upsert({ where: { key: "commission_rate" }, update: {}, create: { key: "commission_rate", value: JSON.stringify({ rate: 0.05 }) } });
  await prisma.appConfig.upsert({ where: { key: "minimum_deposit" }, update: {}, create: { key: "minimum_deposit", value: JSON.stringify({ amount: 15.0 }) } });

  // ===== USERS =====
  const passwordHash = await bcrypt.hash("Test1234!", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@cardscenter.nl", passwordHash, displayName: "Admin",
      accountType: "ADMIN", balance: 5000, isVerified: true, verificationStatus: "APPROVED",
      bankTransferReference: "admin0000000001", createdAt: new Date("2025-01-01"),
      street: "Keizersgracht", houseNumber: "100", postalCode: "1015AA", city: "Amsterdam", country: "NL",
      sellingCountries: "ALL_EU",
    },
  });

  const seller1 = await prisma.user.create({
    data: {
      email: "pikachu@test.nl", passwordHash, displayName: "PikachuTrader",
      accountType: "PRO", balance: 250, isVerified: true, verificationStatus: "APPROVED",
      bankTransferReference: "pikachu0000001", createdAt: new Date("2025-06-15"),
      street: "Damstraat", houseNumber: "12", postalCode: "3011GH", city: "Rotterdam", country: "NL",
      sellingCountries: "ALL_EU",
    },
  });

  const seller2 = await prisma.user.create({
    data: {
      email: "charizard@test.nl", passwordHash, displayName: "CharizardKing",
      accountType: "PRO", balance: 500, isVerified: true, verificationStatus: "APPROVED",
      bankTransferReference: "charizard00001", createdAt: new Date("2025-08-01"),
      street: "Mariaplaats", houseNumber: "5", postalCode: "3511LK", city: "Utrecht", country: "NL",
      sellingCountries: "NL_BE",
    },
  });

  const seller3 = await prisma.user.create({
    data: {
      email: "mewtwo@test.nl", passwordHash, displayName: "MewtwoCollector",
      accountType: "FREE", balance: 100,
      bankTransferReference: "mewtwo00000001", createdAt: new Date("2026-01-10"),
      street: "Grote Markt", houseNumber: "8", postalCode: "9711LV", city: "Groningen", country: "NL",
      sellingCountries: "NL_ONLY",
    },
  });

  const sellerBE = await prisma.user.create({
    data: {
      email: "eevee@test.be", passwordHash, displayName: "EeveeCollector",
      accountType: "PRO", balance: 300, isVerified: true, verificationStatus: "APPROVED",
      bankTransferReference: "eevee000000001", createdAt: new Date("2025-09-20"),
      street: "Meir", houseNumber: "22", postalCode: "2000", city: "Antwerpen", country: "BE",
      sellingCountries: "ALL_EU",
    },
  });

  const sellerDE = await prisma.user.create({
    data: {
      email: "snorlax@test.de", passwordHash, displayName: "SnorlaxHändler",
      accountType: "FREE", balance: 150,
      bankTransferReference: "snorlax0000001", createdAt: new Date("2026-02-05"),
      street: "Friedrichstraße", houseNumber: "45", postalCode: "10117", city: "Berlin", country: "DE",
      sellingCountries: "ALL_EU",
    },
  });

  const buyer = await prisma.user.create({
    data: {
      email: "koper@test.nl", passwordHash, displayName: "TestKoper",
      accountType: "FREE", balance: 1000,
      bankTransferReference: "testkoper00001", createdAt: new Date("2026-02-01"),
      street: "Hoofdweg", houseNumber: "1", postalCode: "1058BB", city: "Amsterdam", country: "NL",
      sellingCountries: "ALL_EU",
    },
  });

  const buyerBE = await prisma.user.create({
    data: {
      email: "koperbe@test.be", passwordHash, displayName: "BelgischeKoper",
      accountType: "FREE", balance: 500,
      bankTransferReference: "koperbe0000001", createdAt: new Date("2026-03-01"),
      street: "Steenstraat", houseNumber: "7", postalCode: "8000", city: "Brugge", country: "BE",
      sellingCountries: "ALL_EU",
    },
  });

  const allSellers = [seller1, seller2, seller3, admin, sellerBE, sellerDE];

  // ===== DEFAULT SHIPPING METHODS =====
  console.log("Creating default shipping methods...");
  const shippingMethods: Record<string, Awaited<ReturnType<typeof createDefaultShippingMethods>>> = {};
  for (const seller of [...allSellers, buyer, buyerBE]) {
    const country = seller.id === sellerBE.id || seller.id === buyerBE.id ? "BE" : seller.id === sellerDE.id ? "DE" : "NL";
    shippingMethods[seller.id] = await createDefaultShippingMethods(seller.id, country);
  }

  // ===== Helpers =====
  function randomSet() { return allSets[Math.floor(Math.random() * allSets.length)]; }
  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

  // Get first 2 methods for linking to items (briefpost + tracked for NL sellers)
  function getMethodsForSeller(sellerId: string) {
    return shippingMethods[sellerId]?.slice(0, 2) ?? [];
  }

  // ===== AUCTIONS (15) =====
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
    { title: "Giratina VSTAR Alt Art", cardName: "Giratina VSTAR", condition: "Near Mint", startingBid: 90, seller: sellerBE, imgIdx: 11 },
    { title: "Alakazam ex SAR 151", cardName: "Alakazam ex", condition: "Near Mint", startingBid: 35, seller: sellerBE, imgIdx: 12 },
    { title: "Lot 10x Base Set Holos", cardName: null, condition: null, startingBid: 180, seller: sellerDE, imgIdx: 13, type: "COLLECTION", estimatedCardCount: 10 },
    { title: "Pikachu VMAX Gold Celebration", cardName: "Pikachu VMAX", condition: "Near Mint", startingBid: 65, seller: sellerDE, imgIdx: 14 },
  ];

  for (const a of auctionData) {
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + pick([3, 5, 7, 14]));
    const set = randomSet();
    const auction = await prisma.auction.create({
      data: {
        title: a.title, auctionType: (a as any).type || "SINGLE_CARD",
        cardName: a.cardName, cardSetId: a.cardName ? set.id : null,
        condition: a.condition, productType: (a as any).productType || null,
        estimatedCardCount: (a as any).estimatedCardCount || null,
        startingBid: a.startingBid, duration: pick([3, 5, 7, 14]),
        endTime, sellerId: a.seller.id, imageUrls: imgJson(a.imgIdx, 3),
        description: `Mooie ${a.title} in uitstekende staat. Bekijk de foto's voor de exacte conditie.`,
        status: "ACTIVE",
      },
    });
    const methods = getMethodsForSeller(a.seller.id);
    for (const method of methods) {
      await prisma.auctionShippingMethod.create({
        data: { auctionId: auction.id, shippingMethodId: method.id, price: method.price },
      });
    }
  }

  // ===== LISTINGS (15) =====
  console.log("Creating listings...");
  const listingData = [
    { title: "Pikachu VMAX Rainbow Rare", cardName: "Pikachu VMAX", condition: "Near Mint", price: 35, seller: seller1, imgIdx: 0 },
    { title: "Arceus VSTAR Gold", cardName: "Arceus VSTAR", condition: "Near Mint", price: 25, seller: seller2, imgIdx: 1 },
    { title: "Charizard UPC Promo", cardName: "Charizard", condition: "Near Mint", price: 60, seller: seller1, imgIdx: 2 },
    { title: "Moonbreon Alt Art", cardName: "Umbreon VMAX", condition: "Lightly Played", price: 180, seller: seller3, imgIdx: 3 },
    { title: "Scarlet & Violet ETB Sealed", cardName: null, condition: null, price: 45, seller: admin, imgIdx: 4, type: "SEALED_PRODUCT", productType: "Elite Trainer Box" },
    { title: "Japanese Vaporeon VMAX SA", cardName: "Vaporeon VMAX", condition: "Near Mint", price: 70, seller: seller2, imgIdx: 5 },
    { title: "Paldea Evolved Booster Bundle", cardName: null, condition: null, price: 30, seller: seller1, imgIdx: 6, type: "SEALED_PRODUCT", productType: "Booster Bundle" },
    { title: "Miraidon ex Special Art Rare", cardName: "Miraidon ex", condition: "Near Mint", price: 22, seller: seller3, imgIdx: 7 },
    { title: "Lot 50x Holographic Cards", cardName: null, condition: null, price: 15, seller: seller2, imgIdx: 8, type: "COLLECTION", estimatedCardCount: 50 },
    { title: "Mew VMAX Alt Art Lost Origin", cardName: "Mew VMAX", condition: "Near Mint", price: 55, seller: admin, imgIdx: 9 },
    { title: "Lechonk AR Obsidian Flames", cardName: "Lechonk", condition: "Near Mint", price: 5, seller: seller1, imgIdx: 10 },
    { title: "Gardevoir ex SAR 151", cardName: "Gardevoir ex", condition: "Near Mint", price: 40, seller: sellerBE, imgIdx: 11 },
    { title: "Charizard ex Obsidian Flames", cardName: "Charizard ex", condition: "Near Mint", price: 28, seller: sellerBE, imgIdx: 12 },
    { title: "Lugia V Alt Art Silver Tempest", cardName: "Lugia V", condition: "Near Mint", price: 85, seller: sellerDE, imgIdx: 13 },
    { title: "Dialga VSTAR Gold Astral Radiance", cardName: "Dialga VSTAR", condition: "Excellent", price: 18, seller: sellerDE, imgIdx: 14 },
  ];

  for (const l of listingData) {
    const set = randomSet();
    const listing = await prisma.listing.create({
      data: {
        title: l.title, description: `Te koop: ${l.title}. Kaart is in perfecte staat, zie foto's.`,
        listingType: (l as any).type || "SINGLE_CARD",
        cardName: l.cardName, cardSetId: l.cardName ? set.id : null,
        condition: l.condition, productType: (l as any).productType || null,
        estimatedCardCount: (l as any).estimatedCardCount || null,
        price: l.price, pricingType: "FIXED", imageUrls: imgJson(l.imgIdx, 2),
        sellerId: l.seller.id, status: "ACTIVE", shippingCost: 1.69,
      },
    });
    const methods = getMethodsForSeller(l.seller.id);
    for (const method of methods) {
      await prisma.listingShippingMethod.create({
        data: { listingId: listing.id, shippingMethodId: method.id, price: method.price },
      });
    }
  }

  // ===== CLAIMSALES (10) =====
  console.log("Creating claimsales...");
  const claimsaleData = [
    {
      title: "Base Set Lot - 20 kaarten", seller: seller1, coverIdx: 0,
      items: [
        { cardName: "Bulbasaur", condition: "Lightly Played", price: 3, ref: "#44", imgIdx: 0 },
        { cardName: "Charmander", condition: "Near Mint", price: 5, ref: "#46", imgIdx: 1 },
        { cardName: "Squirtle", condition: "Near Mint", price: 4, ref: "#63", imgIdx: 2 },
        { cardName: "Pikachu", condition: "Excellent", price: 8, ref: "#58", imgIdx: 3 },
        { cardName: "Nidoran", condition: "Lightly Played", price: 2, ref: "#55", imgIdx: 4 },
      ],
    },
    {
      title: "Modern Hits Claimsale", seller: seller2, coverIdx: 5,
      items: [
        { cardName: "Charizard ex", condition: "Near Mint", price: 15, ref: "SV3-199", imgIdx: 5 },
        { cardName: "Mewtwo VSTAR", condition: "Near Mint", price: 8, ref: "CZ-GG44", imgIdx: 6 },
        { cardName: "Lugia VSTAR", condition: "Near Mint", price: 20, ref: "SIT-186", imgIdx: 7 },
        { cardName: "Giratina V Alt", condition: "Excellent", price: 45, ref: "LOR-130", imgIdx: 8 },
      ],
    },
    {
      title: "Japanese Promos Lot", seller: admin, coverIdx: 9,
      items: [
        { cardName: "Pikachu Promo", condition: "Near Mint", price: 12, ref: "PROMO-001", imgIdx: 9 },
        { cardName: "Eevee Promo", condition: "Near Mint", price: 10, ref: "PROMO-002", imgIdx: 10 },
        { cardName: "Mew Promo", condition: "Lightly Played", price: 18, ref: "PROMO-003", imgIdx: 11 },
      ],
    },
    {
      title: "Evolving Skies Hits", seller: seller3, coverIdx: 12,
      items: [
        { cardName: "Rayquaza VMAX", condition: "Near Mint", price: 55, ref: "EVS-218", imgIdx: 12 },
        { cardName: "Umbreon VMAX", condition: "Near Mint", price: 95, ref: "EVS-215", imgIdx: 13 },
        { cardName: "Dragonite V Alt", condition: "Near Mint", price: 30, ref: "EVS-192", imgIdx: 14 },
        { cardName: "Sylveon VMAX", condition: "Excellent", price: 25, ref: "EVS-212", imgIdx: 15 },
        { cardName: "Glaceon VMAX", condition: "Near Mint", price: 20, ref: "EVS-209", imgIdx: 16 },
        { cardName: "Leafeon VMAX", condition: "Near Mint", price: 18, ref: "EVS-205", imgIdx: 17 },
      ],
    },
    {
      title: "Belgische Vintage Lot", seller: sellerBE, coverIdx: 0,
      items: [
        { cardName: "Machamp 1st Ed", condition: "Excellent", price: 12, ref: "BS-8", imgIdx: 0 },
        { cardName: "Alakazam Base Set", condition: "Lightly Played", price: 18, ref: "BS-1", imgIdx: 1 },
        { cardName: "Gyarados Base Set", condition: "Near Mint", price: 15, ref: "BS-6", imgIdx: 2 },
        { cardName: "Chansey Base Set", condition: "Near Mint", price: 10, ref: "BS-3", imgIdx: 3 },
        { cardName: "Clefairy Base Set", condition: "Excellent", price: 8, ref: "BS-5", imgIdx: 4 },
      ],
    },
    {
      title: "Deutsche Sammlung Hits", seller: sellerDE, coverIdx: 5,
      items: [
        { cardName: "Mewtwo ex 151", condition: "Near Mint", price: 22, ref: "151-150", imgIdx: 5 },
        { cardName: "Venusaur ex 151", condition: "Near Mint", price: 8, ref: "151-003", imgIdx: 6 },
        { cardName: "Blastoise ex 151", condition: "Near Mint", price: 10, ref: "151-009", imgIdx: 7 },
        { cardName: "Erikas Invitation", condition: "Near Mint", price: 35, ref: "151-196", imgIdx: 8 },
      ],
    },
    {
      title: "Sword & Shield V Cards", seller: seller1, coverIdx: 9,
      items: [
        { cardName: "Zacian V", condition: "Near Mint", price: 5, ref: "SSH-138", imgIdx: 9 },
        { cardName: "Zamazenta V", condition: "Near Mint", price: 4, ref: "SSH-139", imgIdx: 10 },
        { cardName: "Eternatus VMAX", condition: "Near Mint", price: 7, ref: "DAA-117", imgIdx: 11 },
        { cardName: "Crobat VMAX", condition: "Near Mint", price: 3, ref: "SHF-045", imgIdx: 12 },
      ],
    },
    {
      title: "Crown Zenith Galarian Gallery", seller: seller2, coverIdx: 13,
      items: [
        { cardName: "Charizard VSTAR GG", condition: "Near Mint", price: 20, ref: "CZ-GG70", imgIdx: 13 },
        { cardName: "Pikachu VMAX GG", condition: "Near Mint", price: 12, ref: "CZ-GG58", imgIdx: 14 },
        { cardName: "Moltres GG", condition: "Near Mint", price: 6, ref: "CZ-GG08", imgIdx: 15 },
        { cardName: "Articuno GG", condition: "Near Mint", price: 5, ref: "CZ-GG06", imgIdx: 16 },
        { cardName: "Zapdos GG", condition: "Near Mint", price: 5, ref: "CZ-GG07", imgIdx: 17 },
      ],
    },
    {
      title: "Budget Lot - Alles onder €5", seller: seller3, coverIdx: 0,
      items: [
        { cardName: "Wooloo", condition: "Near Mint", price: 1, ref: "SSH-152", imgIdx: 0 },
        { cardName: "Sobble", condition: "Near Mint", price: 1, ref: "SSH-055", imgIdx: 1 },
        { cardName: "Rookidee", condition: "Near Mint", price: 1, ref: "SSH-150", imgIdx: 2 },
        { cardName: "Toxel", condition: "Excellent", price: 2, ref: "SSH-072", imgIdx: 3 },
        { cardName: "Dreepy", condition: "Near Mint", price: 2, ref: "SSH-089", imgIdx: 4 },
        { cardName: "Snom", condition: "Near Mint", price: 1, ref: "SSH-063", imgIdx: 5 },
        { cardName: "Applin", condition: "Near Mint", price: 1, ref: "SSH-020", imgIdx: 6 },
        { cardName: "Hatenna", condition: "Near Mint", price: 1, ref: "SSH-084", imgIdx: 7 },
      ],
    },
    {
      title: "Paldean Fates Shiny Vault", seller: sellerBE, coverIdx: 8,
      items: [
        { cardName: "Shiny Charizard ex", condition: "Near Mint", price: 40, ref: "PAF-SV29", imgIdx: 8 },
        { cardName: "Shiny Gardevoir ex", condition: "Near Mint", price: 15, ref: "PAF-SV45", imgIdx: 9 },
        { cardName: "Shiny Ceruledge ex", condition: "Near Mint", price: 8, ref: "PAF-SV36", imgIdx: 10 },
        { cardName: "Shiny Palafin", condition: "Near Mint", price: 3, ref: "PAF-SV11", imgIdx: 11 },
        { cardName: "Shiny Tinkaton", condition: "Near Mint", price: 4, ref: "PAF-SV48", imgIdx: 12 },
      ],
    },
  ];

  for (const cs of claimsaleData) {
    const claimsale = await prisma.claimsale.create({
      data: {
        title: cs.title, description: `Claimsale: ${cs.title}. Claim individuele kaarten, op is op!`,
        coverImage: img(cs.coverIdx), sellerId: cs.seller.id,
        shippingCost: 1.69, status: "LIVE", publishedAt: new Date(),
      },
    });
    const set = randomSet();
    for (const item of cs.items) {
      await prisma.claimsaleItem.create({
        data: {
          cardName: item.cardName, condition: item.condition, price: item.price,
          reference: item.ref, imageUrls: imgJson(item.imgIdx, 2),
          cardSetId: set.id, claimsaleId: claimsale.id, status: "AVAILABLE",
        },
      });
    }
    const methods = getMethodsForSeller(cs.seller.id);
    for (const method of methods) {
      await prisma.claimsaleShippingMethod.create({
        data: { claimsaleId: claimsale.id, shippingMethodId: method.id, price: method.price },
      });
    }
  }

  // ===== REVIEWS =====
  console.log("Creating reviews...");
  const reviewPairs = [
    { reviewer: buyer, seller: seller1, rating: 5, comment: "Snelle verzending, mooie kaart!" },
    { reviewer: buyer, seller: seller2, rating: 4, comment: "Goed verpakt, aanrader." },
    { reviewer: buyer, seller: sellerBE, rating: 5, comment: "Top verkoper, snel geleverd naar NL!" },
    { reviewer: buyerBE, seller: seller1, rating: 5, comment: "Perfecte kaart, snelle verzending naar België." },
    { reviewer: buyerBE, seller: sellerDE, rating: 4, comment: "Goed verpakt, kaart als beschreven." },
    { reviewer: seller1, seller: seller2, rating: 5, comment: "Altijd betrouwbaar, topverkoper." },
  ];
  for (const r of reviewPairs) {
    await prisma.review.create({
      data: { reviewerId: r.reviewer.id, sellerId: r.seller.id, rating: r.rating, comment: r.comment },
    });
  }

  // ===== SHIPPING BUNDLES (purchases/sales for TestKoper) =====
  console.log("Creating purchases and sales...");

  // Helper to generate order numbers
  function orderNum(i: number) {
    return `ORD-20260409-${String(1000 + i)}`;
  }

  // Helper to safely get a shipping method
  function getMethod(sellerId: string, index: number) {
    return shippingMethods[sellerId]?.[index]?.id ?? null;
  }

  // TestKoper bought from PikachuTrader — COMPLETED
  const bundle1 = await prisma.shippingBundle.create({
    data: {
      orderNumber: orderNum(1),
      buyerId: buyer.id, sellerId: seller1.id,
      shippingCost: 4.85, totalItemCost: 35, totalCost: 39.85,
      status: "COMPLETED",
      shippingMethodId: getMethod(seller1.id, 1), // brievenbuspakket
      trackingUrl: "https://postnl.nl/tracktrace/T0001",
      shippedAt: new Date("2026-04-02"), deliveredAt: new Date("2026-04-04"),
      buyerStreet: "Hoofdweg", buyerHouseNumber: "1", buyerPostalCode: "1058BB", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });

  // TestKoper bought from CharizardKing — SHIPPED (in transit)
  const bundle2 = await prisma.shippingBundle.create({
    data: {
      orderNumber: orderNum(2),
      buyerId: buyer.id, sellerId: seller2.id,
      shippingCost: 10.45, totalItemCost: 70, totalCost: 80.45,
      status: "SHIPPED",
      shippingMethodId: getMethod(seller2.id, 2), // aangetekend
      trackingUrl: "https://postnl.nl/tracktrace/T0002",
      shippedAt: new Date("2026-04-07"),
      buyerStreet: "Hoofdweg", buyerHouseNumber: "1", buyerPostalCode: "1058BB", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });

  // TestKoper bought from EeveeCollector (BE) — PAID (awaiting shipment)
  const bundle3 = await prisma.shippingBundle.create({
    data: {
      orderNumber: orderNum(3),
      buyerId: buyer.id, sellerId: sellerBE.id,
      shippingCost: 15.50, totalItemCost: 40, totalCost: 55.50,
      status: "PAID",
      shippingMethodId: getMethod(sellerBE.id, 1), // aangetekend
      buyerStreet: "Hoofdweg", buyerHouseNumber: "1", buyerPostalCode: "1058BB", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });

  // TestKoper bought from MewtwoCollector — COMPLETED (briefpost, cheap card)
  const bundle4 = await prisma.shippingBundle.create({
    data: {
      orderNumber: orderNum(4),
      buyerId: buyer.id, sellerId: seller3.id,
      shippingCost: 1.69, totalItemCost: 8, totalCost: 9.69,
      status: "COMPLETED",
      shippingMethodId: getMethod(seller3.id, 0), // briefpost
      shippedAt: new Date("2026-04-01"), deliveredAt: new Date("2026-04-05"),
      buyerStreet: "Hoofdweg", buyerHouseNumber: "1", buyerPostalCode: "1058BB", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });

  // BelgischeKoper bought from PikachuTrader — SHIPPED
  const bundle5 = await prisma.shippingBundle.create({
    data: {
      orderNumber: orderNum(5),
      buyerId: buyerBE.id, sellerId: seller1.id,
      shippingCost: 15.50, totalItemCost: 55, totalCost: 70.50,
      status: "SHIPPED",
      shippingMethodId: getMethod(seller1.id, 4), // EU aangetekend
      trackingUrl: "https://postnl.nl/tracktrace/T0005",
      shippedAt: new Date("2026-04-06"),
      buyerStreet: "Steenstraat", buyerHouseNumber: "7", buyerPostalCode: "8000", buyerCity: "Brugge", buyerCountry: "BE",
    },
  });

  // Link some existing listings to bundles as SOLD
  const soldListings = await prisma.listing.findMany({
    where: { status: "ACTIVE", sellerId: { in: [seller1.id, seller2.id] } },
    take: 2,
  });
  if (soldListings[0]) {
    await prisma.listing.update({ where: { id: soldListings[0].id }, data: { status: "SOLD", buyerId: buyer.id } });
    await prisma.shippingBundle.update({ where: { id: bundle1.id }, data: { listingId: soldListings[0].id } });
  }
  if (soldListings[1]) {
    await prisma.listing.update({ where: { id: soldListings[1].id }, data: { status: "SOLD", buyerId: buyer.id } });
    await prisma.shippingBundle.update({ where: { id: bundle2.id }, data: { listingId: soldListings[1].id } });
  }

  // ===== TestKoper als VERKOPER — bundles met status PAID (klaar om te verzenden) =====
  // Eerst listings aanmaken van TestKoper
  const koperListings = await Promise.all([
    prisma.listing.create({
      data: {
        title: "Espeon VMAX Alt Art", description: "Prachtige Espeon VMAX Alt Art, NM conditie.",
        listingType: "SINGLE_CARD", cardName: "Espeon VMAX", cardSetId: randomSet().id,
        condition: "Near Mint", price: 45, pricingType: "FIXED",
        imageUrls: imgJson(15, 2), sellerId: buyer.id, status: "SOLD", buyerId: seller1.id,
        shippingCost: 4.85,
      },
    }),
    prisma.listing.create({
      data: {
        title: "Gengar VMAX Alt Art", description: "Gengar VMAX Alt Art in perfecte staat.",
        listingType: "SINGLE_CARD", cardName: "Gengar VMAX", cardSetId: randomSet().id,
        condition: "Near Mint", price: 12, pricingType: "FIXED",
        imageUrls: imgJson(7, 2), sellerId: buyer.id, status: "SOLD", buyerId: seller2.id,
        shippingCost: 1.69,
      },
    }),
    prisma.listing.create({
      data: {
        title: "Sylveon VMAX Alt Art", description: "Sylveon VMAX Alt Art, lichte speelsporen.",
        listingType: "SINGLE_CARD", cardName: "Sylveon VMAX", cardSetId: randomSet().id,
        condition: "Lightly Played", price: 35, pricingType: "FIXED",
        imageUrls: imgJson(3, 2), sellerId: buyer.id, status: "SOLD", buyerId: sellerBE.id,
        shippingCost: 15.50,
      },
    }),
  ]);

  // Bundle: PikachuTrader kocht van TestKoper — PAID (tracked, wacht op verzending)
  await prisma.shippingBundle.create({
    data: {
      orderNumber: orderNum(6),
      buyerId: seller1.id, sellerId: buyer.id,
      shippingCost: 4.85, totalItemCost: 45, totalCost: 49.85,
      status: "PAID",
      shippingMethodId: getMethod(buyer.id, 1), // brievenbuspakket
      listingId: koperListings[0].id,
      buyerStreet: "Damstraat", buyerHouseNumber: "12", buyerPostalCode: "3011GH", buyerCity: "Rotterdam", buyerCountry: "NL",
    },
  });

  // Bundle: CharizardKing kocht van TestKoper — PAID (briefpost, goedkope kaart → foto testen!)
  await prisma.shippingBundle.create({
    data: {
      orderNumber: orderNum(7),
      buyerId: seller2.id, sellerId: buyer.id,
      shippingCost: 1.69, totalItemCost: 12, totalCost: 13.69,
      status: "PAID",
      shippingMethodId: getMethod(buyer.id, 0), // briefpost
      listingId: koperListings[1].id,
      buyerStreet: "Mariaplaats", buyerHouseNumber: "5", buyerPostalCode: "3511LK", buyerCity: "Utrecht", buyerCountry: "NL",
    },
  });

  // Bundle: EeveeCollector (BE) kocht van TestKoper — PAID (internationaal, aangetekend verplicht)
  await prisma.shippingBundle.create({
    data: {
      orderNumber: orderNum(8),
      buyerId: sellerBE.id, sellerId: buyer.id,
      shippingCost: 15.50, totalItemCost: 35, totalCost: 50.50,
      status: "PAID",
      shippingMethodId: getMethod(buyer.id, 4), // EU aangetekend
      listingId: koperListings[2].id,
      buyerStreet: "Meir", buyerHouseNumber: "22", buyerPostalCode: "2000", buyerCity: "Antwerpen", buyerCountry: "BE",
    },
  });

  console.log("Seeding complete!");
  console.log("Test accounts (wachtwoord: Test1234!):");
  console.log("  admin@cardscenter.nl (Admin - NL - ALL_EU)");
  console.log("  pikachu@test.nl (PikachuTrader - PRO - NL - ALL_EU)");
  console.log("  charizard@test.nl (CharizardKing - PRO - NL - NL_BE)");
  console.log("  mewtwo@test.nl (MewtwoCollector - FREE - NL - NL_ONLY)");
  console.log("  eevee@test.be (EeveeCollector - PRO - BE - ALL_EU)");
  console.log("  snorlax@test.de (SnorlaxHändler - FREE - DE - ALL_EU)");
  console.log("  koper@test.nl (TestKoper - NL)");
  console.log("  koperbe@test.be (BelgischeKoper - BE)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
