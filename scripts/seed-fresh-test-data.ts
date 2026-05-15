/**
 * Verse test-data voor /dashboard/veilingen, /marktplaats, /claimsales.
 * Voegt items toe ZONDER bestaande data te wissen.
 *
 * Run: npx tsx scripts/seed-fresh-test-data.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const IMG = [
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

const img = (i: number) => IMG[i % IMG.length];
const imgJson = (start: number, count = 1) =>
  JSON.stringify(Array.from({ length: count }, (_, i) => IMG[(start + i) % IMG.length]));
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min: number, max: number) =>
  Math.round((Math.random() * (max - min) + min) * 100) / 100;
const pick = <T>(arr: T[], i: number): T => arr[((i % arr.length) + arr.length) % arr.length];

function genOrderNumber(): string {
  const d = new Date();
  return `ORD-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}-${rand(1000, 9999)}`;
}

// DOMESTIC base prices uit src/lib/shipping/tariffs.ts (2025/2026-data)
const BASE_PRICES: Record<string, Record<string, number>> = {
  NL: { MAILBOX_PARCEL: 5.5, PARCEL_STANDARD: 7.85, PARCEL_SIGNED: 10.95 },
  BE: { MAILBOX_PARCEL: 5.2, PARCEL_STANDARD: 7.5, PARCEL_SIGNED: 10.5 },
  DE: { MAILBOX_PARCEL: 4.5, PARCEL_STANDARD: 6.99, PARCEL_SIGNED: 9.95 },
};

function effectivePrice(
  m: { service: string | null; zone: string | null; priceOverride: number | null; price: number | null },
  country: string
): number {
  if (m.priceOverride != null) return m.priceOverride;
  if (m.service && m.zone === "DOMESTIC" && BASE_PRICES[country]?.[m.service] != null) {
    return BASE_PRICES[country][m.service];
  }
  if (m.price != null) return m.price;
  return 5.0;
}

async function main() {
  console.log("=== Fresh test-data seeder (additive — bestaande data blijft) ===\n");

  const SELLER_EMAILS = [
    "pikachu@test.nl",
    "charizard@test.nl",
    "mewtwo@test.nl",
    "eevee@test.be",
    "snorlax@test.de",
    "seller@fase27.test",
    "yourivankerkhoven@gmail.com",
    "youribeppo@gmail.com",
  ];
  const BUYER_EMAILS = [
    "koper@test.nl",
    "koperbe@test.be",
    "buyer@fase27.test",
    "buyer2@fase27.test",
    "pikafan@test.nl",
    "max@test.nl",
    "youribeppo@gmail.com",
    "yourivankerkhoven@gmail.com",
  ];

  const sellers = await Promise.all(
    SELLER_EMAILS.map((email) =>
      prisma.user.findUniqueOrThrow({
        where: { email },
        include: { sellerShippingMethods: { where: { isActive: true } } },
      })
    )
  );
  const buyers = await Promise.all(
    BUYER_EMAILS.map((email) => prisma.user.findUniqueOrThrow({ where: { email } }))
  );

  function shippingForSeller(sellerIdx: number): { id: string; price: number }[] {
    const s = sellers[sellerIdx];
    const country = s.country ?? "NL";
    return s.sellerShippingMethods
      .filter((m) => m.service && m.zone === "DOMESTIC")
      .map((m) => ({ id: m.id, price: effectivePrice(m, country) }));
  }

  const now = new Date();

  // ====================================================================
  // LISTINGS — 10 stuks, gemixt over types, sellers en delivery-modes
  // ====================================================================
  console.log("Creating listings...");
  const listingSpecs: Array<{
    sellerIdx: number;
    type: string;
    title: string;
    cardName?: string;
    condition?: string;
    cardItems?: Array<{ cardName: string; condition: string; quantity: number }>;
    estimatedCardCount?: number;
    conditionRange?: string;
    productType?: string;
    itemCategory?: string;
    stockQuantity?: number;
    price: number | null;
    suggestedPrice?: number;
    pricingType: string;
    deliveryMethod: string;
    imageIdx: number;
    imgCount: number;
  }> = [
    {
      sellerIdx: 0,
      type: "SINGLE_CARD",
      title: "Charizard Base Set Holo — PSA 8 (mint case)",
      cardName: "Charizard Base Set Holo",
      condition: "Near Mint",
      price: 1250,
      pricingType: "FIXED",
      deliveryMethod: "SHIP",
      imageIdx: 0,
      imgCount: 4,
    },
    {
      sellerIdx: 1,
      type: "SINGLE_CARD",
      title: "Pikachu Illustrator (replica) — Bod doen",
      cardName: "Pikachu Illustrator (replica)",
      condition: "Lightly Played",
      price: null,
      suggestedPrice: 75,
      pricingType: "NEGOTIABLE",
      deliveryMethod: "BOTH",
      imageIdx: 2,
      imgCount: 3,
    },
    {
      sellerIdx: 2,
      type: "MULTI_CARD",
      title: "Lot 25× Eevee Evolutions kaarten (NM/LP)",
      cardItems: [
        { cardName: "Vaporeon", condition: "NM", quantity: 5 },
        { cardName: "Jolteon", condition: "NM", quantity: 5 },
        { cardName: "Flareon", condition: "LP", quantity: 5 },
        { cardName: "Espeon", condition: "NM", quantity: 5 },
        { cardName: "Umbreon", condition: "NM", quantity: 5 },
      ],
      price: 85.5,
      pricingType: "FIXED",
      deliveryMethod: "SHIP",
      imageIdx: 5,
      imgCount: 5,
    },
    {
      sellerIdx: 3,
      type: "COLLECTION",
      title: "Verzameling Sword & Shield — 800+ kaarten (BE)",
      estimatedCardCount: 820,
      conditionRange: "Lightly Played – Near Mint",
      price: 245,
      pricingType: "FIXED",
      deliveryMethod: "PICKUP",
      imageIdx: 7,
      imgCount: 4,
    },
    {
      sellerIdx: 4,
      type: "SEALED_PRODUCT",
      title: "Pokémon 151 Booster Box (DE) — 36 packs sealed",
      productType: "BOOSTER_BOX",
      stockQuantity: 4,
      price: 189,
      pricingType: "FIXED",
      deliveryMethod: "SHIP",
      imageIdx: 10,
      imgCount: 2,
    },
    {
      sellerIdx: 5,
      type: "SEALED_PRODUCT",
      title: "Paldea Evolved ETB (sealed)",
      productType: "ETB",
      stockQuantity: 12,
      price: 49.95,
      pricingType: "FIXED",
      deliveryMethod: "BOTH",
      imageIdx: 11,
      imgCount: 2,
    },
    {
      sellerIdx: 6,
      type: "OTHER",
      title: "Pokémon Playmat XL — Mewtwo art",
      itemCategory: "Playmat",
      stockQuantity: 3,
      price: 29.5,
      pricingType: "FIXED",
      deliveryMethod: "SHIP",
      imageIdx: 13,
      imgCount: 2,
    },
    {
      sellerIdx: 7,
      type: "SINGLE_CARD",
      title: "Moonbreon (Umbreon V-MAX Alt Art) — bieden",
      cardName: "Umbreon V-MAX Alt Art (Evolving Skies)",
      condition: "Near Mint",
      price: null,
      suggestedPrice: 410,
      pricingType: "NEGOTIABLE",
      deliveryMethod: "SHIP",
      imageIdx: 14,
      imgCount: 3,
    },
    {
      sellerIdx: 0,
      type: "MULTI_CARD",
      title: "Lot 12× WOTC Vintage Holo's (Base + Fossil)",
      cardItems: [
        { cardName: "Blastoise Base", condition: "LP", quantity: 1 },
        { cardName: "Venusaur Base", condition: "LP", quantity: 1 },
        { cardName: "Charizard Base", condition: "HP", quantity: 1 },
        { cardName: "Mewtwo Base", condition: "NM", quantity: 1 },
        { cardName: "Alakazam Base", condition: "NM", quantity: 1 },
        { cardName: "Machamp 1st Ed", condition: "NM", quantity: 1 },
        { cardName: "Gyarados Base", condition: "LP", quantity: 1 },
        { cardName: "Magneton Base", condition: "NM", quantity: 1 },
        { cardName: "Nidoking Base", condition: "NM", quantity: 1 },
        { cardName: "Poliwrath Base", condition: "LP", quantity: 1 },
        { cardName: "Raichu Base", condition: "LP", quantity: 1 },
        { cardName: "Zapdos Fossil", condition: "NM", quantity: 1 },
      ],
      price: null,
      suggestedPrice: 580,
      pricingType: "NEGOTIABLE",
      deliveryMethod: "SHIP",
      imageIdx: 15,
      imgCount: 4,
    },
    {
      sellerIdx: 1,
      type: "OTHER",
      title: "Premium 9-pocket Side-load Binder (zwart)",
      itemCategory: "Binder",
      stockQuantity: 15,
      price: 19.95,
      pricingType: "FIXED",
      deliveryMethod: "BOTH",
      imageIdx: 16,
      imgCount: 1,
    },
  ];

  let listingsCreated = 0;
  for (const s of listingSpecs) {
    const seller = sellers[s.sellerIdx];
    const methods = shippingForSeller(s.sellerIdx);
    const cheapest = methods[0];

    const description =
      s.type === "SINGLE_CARD"
        ? "Strikt opgeborgen in toploader + sleeve. Wordt verzonden in een stevige enveloppe of pakket met bubbel."
        : s.type === "COLLECTION"
        ? "Mooie verzameling, alle staat duidelijk zichtbaar in foto's. Geen inboundische verrassingen, beschrijving = wat je krijgt."
        : s.type === "SEALED_PRODUCT"
        ? "100% sealed, rechtstreeks van distributor. Niet op weight of warmtevervorming gecheckt — gewoon factory-fresh."
        : s.type === "MULTI_CARD"
        ? "Bundel van losse kaarten. Per kaart staat de staat in de titel — vraag foto's per kaart als nodig."
        : "Item in nette staat, zie foto's voor details. Reëel beschreven.";

    const listing = await prisma.listing.create({
      data: {
        title: s.title,
        description,
        imageUrls: imgJson(s.imageIdx, s.imgCount),
        listingType: s.type,
        ...(s.cardName && { cardName: s.cardName }),
        ...(s.condition && { condition: s.condition }),
        ...(s.cardItems && { cardItems: JSON.stringify(s.cardItems) }),
        ...(s.estimatedCardCount && {
          estimatedCardCount: s.estimatedCardCount,
          conditionRange: s.conditionRange,
        }),
        ...(s.productType && { productType: s.productType }),
        ...(s.itemCategory && { itemCategory: s.itemCategory }),
        ...(s.stockQuantity != null && { stockQuantity: s.stockQuantity }),
        pricingType: s.pricingType,
        price: s.price,
        ...(s.suggestedPrice && { suggestedPrice: s.suggestedPrice }),
        deliveryMethod: s.deliveryMethod,
        shippingCost: s.deliveryMethod === "PICKUP" ? 0 : cheapest?.price ?? 0,
        pickupCity:
          s.deliveryMethod === "PICKUP" || s.deliveryMethod === "BOTH"
            ? seller.city ?? "Amsterdam"
            : null,
        sellerId: seller.id,
        status: "ACTIVE",
        // PICKUP/BOTH-toggle defaults staan al goed (beide true via schema-default)
      },
    });

    if (s.deliveryMethod !== "PICKUP" && methods.length > 0) {
      await prisma.listingShippingMethod.createMany({
        data: methods.map((m) => ({ listingId: listing.id, shippingMethodId: m.id, price: m.price })),
      });
    }

    // Stocked listings (SEALED_PRODUCT / OTHER met stockQuantity > 1) — maak
    // ListingCardItem-rijen voor stock-tracking (Fase 27.23)
    if (
      (s.type === "SEALED_PRODUCT" || s.type === "OTHER") &&
      (s.stockQuantity ?? 1) > 1
    ) {
      await prisma.listingCardItem.createMany({
        data: Array.from({ length: s.stockQuantity! }, () => ({
          listingId: listing.id,
          cardName: s.title,
          quantity: 1,
          status: "AVAILABLE",
        })),
      });
    }

    listingsCreated++;
  }
  console.log(`  ✓ ${listingsCreated} listings\n`);

  // ====================================================================
  // AUCTIONS — 10 stuks, mix ACTIVE + SCHEDULED, met/zonder buy-now/reserve
  // ====================================================================
  console.log("Creating auctions...");
  type AuctionSpec = {
    sellerIdx: number;
    type: string;
    title: string;
    cardName?: string;
    condition?: string;
    cardItems?: Array<{ cardName: string; condition: string; quantity: number }>;
    estimatedCardCount?: number;
    conditionRange?: string;
    productType?: string;
    itemCategory?: string;
    startingBid: number;
    buyNowPrice: number | null;
    reservePrice: number | null;
    duration: 3 | 5 | 7 | 14;
    scheduled?: boolean;
    startOffsetHours?: number; // future-start in uren (alleen voor scheduled)
    imageIdx: number;
    imgCount: number;
  };

  const auctionSpecs: AuctionSpec[] = [
    {
      sellerIdx: 0,
      type: "SINGLE_CARD",
      title: "🔥 Charizard 1st Edition Base PSA 7",
      cardName: "Charizard 1st Edition Base",
      condition: "Near Mint",
      startingBid: 850,
      buyNowPrice: 1450,
      reservePrice: 1100,
      duration: 7,
      imageIdx: 0,
      imgCount: 3,
    },
    {
      sellerIdx: 2,
      type: "SINGLE_CARD",
      title: "Pikachu V-Union Promo (sealed bundle, 4 kaarten)",
      cardName: "Pikachu V-Union",
      condition: "Mint (sealed)",
      startingBid: 35,
      buyNowPrice: null,
      reservePrice: null,
      duration: 5,
      imageIdx: 3,
      imgCount: 2,
    },
    {
      sellerIdx: 1,
      type: "SINGLE_CARD",
      title: "Mewtwo & Mew GX Tag Team Full Art (S&M Era)",
      cardName: "Mewtwo & Mew GX",
      condition: "Near Mint",
      startingBid: 1,
      buyNowPrice: 95,
      reservePrice: 65,
      duration: 3,
      imageIdx: 5,
      imgCount: 2,
    },
    {
      sellerIdx: 3,
      type: "SEALED_PRODUCT",
      title: "Hidden Fates ETB (sealed, BE warehouse)",
      productType: "ETB",
      startingBid: 250,
      buyNowPrice: 380,
      reservePrice: null,
      duration: 7,
      imageIdx: 7,
      imgCount: 2,
    },
    {
      sellerIdx: 4,
      type: "SINGLE_CARD",
      title: "Lugia V Alt Art — Silver Tempest (DE)",
      cardName: "Lugia V Alt Art",
      condition: "Near Mint",
      startingBid: 60,
      buyNowPrice: null,
      reservePrice: 95,
      duration: 5,
      imageIdx: 9,
      imgCount: 3,
    },
    {
      sellerIdx: 5,
      type: "MULTI_CARD",
      title: "Lot 8× Energy Reverse Holo's (NM, modern)",
      cardItems: [
        { cardName: "Grass Energy RH", condition: "NM", quantity: 1 },
        { cardName: "Fire Energy RH", condition: "NM", quantity: 1 },
        { cardName: "Water Energy RH", condition: "NM", quantity: 1 },
        { cardName: "Lightning Energy RH", condition: "NM", quantity: 1 },
        { cardName: "Psychic Energy RH", condition: "NM", quantity: 1 },
        { cardName: "Fighting Energy RH", condition: "NM", quantity: 1 },
        { cardName: "Darkness Energy RH", condition: "NM", quantity: 1 },
        { cardName: "Metal Energy RH", condition: "NM", quantity: 1 },
      ],
      startingBid: 5,
      buyNowPrice: 22,
      reservePrice: null,
      duration: 3,
      imageIdx: 11,
      imgCount: 3,
    },
    {
      sellerIdx: 6,
      type: "COLLECTION",
      title: "Verzameling Scarlet & Violet — 500+ kaarten",
      estimatedCardCount: 530,
      conditionRange: "Lightly Played – Near Mint",
      startingBid: 75,
      buyNowPrice: 195,
      reservePrice: 140,
      duration: 14,
      imageIdx: 13,
      imgCount: 4,
    },
    // ===== SCHEDULED (start in toekomst) =====
    {
      sellerIdx: 7,
      type: "SINGLE_CARD",
      title: "🆕 Moonbreon Alt Art — start morgenavond",
      cardName: "Umbreon V-MAX Alt Art",
      condition: "Near Mint",
      startingBid: 280,
      buyNowPrice: 480,
      reservePrice: 380,
      duration: 5,
      scheduled: true,
      startOffsetHours: 24,
      imageIdx: 15,
      imgCount: 3,
    },
    {
      sellerIdx: 0,
      type: "SEALED_PRODUCT",
      title: "Pokémon 151 Booster Box — start over 3 dagen",
      productType: "BOOSTER_BOX",
      startingBid: 145,
      buyNowPrice: 220,
      reservePrice: 170,
      duration: 7,
      scheduled: true,
      startOffsetHours: 72,
      imageIdx: 1,
      imgCount: 2,
    },
    {
      sellerIdx: 1,
      type: "OTHER",
      title: "Tournament-set Pokémon Damage Counters (compleet)",
      itemCategory: "Accessoire",
      startingBid: 8,
      buyNowPrice: 18,
      reservePrice: null,
      duration: 3,
      imageIdx: 17,
      imgCount: 1,
    },
  ];

  type CreatedAuction = {
    id: string;
    sellerIdx: number;
    startingBid: number;
    scheduled: boolean;
  };
  const createdAuctions: CreatedAuction[] = [];

  for (const s of auctionSpecs) {
    const seller = sellers[s.sellerIdx];
    const methods = shippingForSeller(s.sellerIdx);
    const startTime = s.scheduled
      ? new Date(now.getTime() + (s.startOffsetHours ?? 24) * 3600_000)
      : new Date(now.getTime() - 3600_000); // 1u geleden gestart
    const endTime = new Date(startTime.getTime() + s.duration * 24 * 3600_000);

    const auction = await prisma.auction.create({
      data: {
        title: s.title,
        description: `Veiling van ${seller.displayName}. Wordt zorgvuldig verzonden binnen 2 werkdagen na betaling. Betaling via wallet/escrow.`,
        imageUrls: imgJson(s.imageIdx, s.imgCount),
        auctionType: s.type,
        ...(s.cardName && { cardName: s.cardName }),
        ...(s.condition && { condition: s.condition }),
        ...(s.cardItems && { cardItems: JSON.stringify(s.cardItems) }),
        ...(s.estimatedCardCount && {
          estimatedCardCount: s.estimatedCardCount,
          conditionRange: s.conditionRange,
        }),
        ...(s.productType && { productType: s.productType }),
        ...(s.itemCategory && { itemCategory: s.itemCategory }),
        sellerId: seller.id,
        startingBid: s.startingBid,
        reservePrice: s.reservePrice,
        buyNowPrice: s.buyNowPrice,
        duration: s.duration,
        startTime,
        endTime,
        status: s.scheduled ? "SCHEDULED" : "ACTIVE",
        deliveryMethod: "SHIP",
      },
    });

    if (methods.length > 0) {
      await prisma.auctionShippingMethod.createMany({
        data: methods.map((m) => ({
          auctionId: auction.id,
          shippingMethodId: m.id,
          price: m.price,
        })),
      });
    }

    createdAuctions.push({
      id: auction.id,
      sellerIdx: s.sellerIdx,
      startingBid: s.startingBid,
      scheduled: s.scheduled ?? false,
    });
  }
  console.log(`  ✓ ${auctionSpecs.length} auctions (${createdAuctions.filter((a) => a.scheduled).length} SCHEDULED, rest ACTIVE)\n`);

  // ====================================================================
  // BIDS — 3-7 per ACTIVE auction
  // ====================================================================
  console.log("Creating bids...");
  let totalBids = 0;
  for (const a of createdAuctions) {
    if (a.scheduled) continue;
    const numBids = rand(3, 7);
    const sellerEmail = sellers[a.sellerIdx].email;
    const availableBuyers = buyers.filter((b) => b.email !== sellerEmail);

    let currentBid = a.startingBid;
    for (let i = 0; i < numBids; i++) {
      const buyer = pick(availableBuyers, i * 7 + rand(0, 100));
      const increment =
        currentBid < 10
          ? rand(1, 3)
          : currentBid < 50
          ? rand(2, 5)
          : currentBid < 200
          ? rand(5, 15)
          : rand(10, 50);
      currentBid = currentBid + increment;

      await prisma.auctionBid.create({
        data: {
          amount: currentBid,
          auctionId: a.id,
          bidderId: buyer.id,
          createdAt: new Date(now.getTime() - (numBids - i) * 1800_000), // gespreid over laatste paar uur
        },
      });
      totalBids++;
    }

    await prisma.auction.update({ where: { id: a.id }, data: { currentBid } });
  }
  console.log(`  ✓ ${totalBids} bids over alle ACTIVE veilingen\n`);

  // ====================================================================
  // CLAIMSALES — 10 stuks met 5-15 items elk
  // ====================================================================
  console.log("Creating claimsales...");
  const claimsaleSpecs: Array<{ sellerIdx: number; title: string; coverIdx: number; items: number }> = [
    { sellerIdx: 0, title: "Vintage WOTC Holo Drop — losse pulls", coverIdx: 0, items: 10 },
    { sellerIdx: 1, title: "Charizard-themed Single Pulls", coverIdx: 2, items: 8 },
    { sellerIdx: 2, title: "Eevee Evolutions Showcase", coverIdx: 5, items: 12 },
    { sellerIdx: 3, title: "BE/NL Trainer Cards Restock", coverIdx: 7, items: 9 },
    { sellerIdx: 4, title: "DE Single Card Lot (modern era)", coverIdx: 9, items: 7 },
    { sellerIdx: 5, title: "Scarlet & Violet Singles Drop", coverIdx: 11, items: 15 },
    { sellerIdx: 6, title: "Holo Rares — Modern Era Mix", coverIdx: 13, items: 8 },
    { sellerIdx: 7, title: "Moonbreon-related Singles (NM)", coverIdx: 15, items: 6 },
    { sellerIdx: 0, title: "Energy Special Reverse Holo's", coverIdx: 17, items: 8 },
    { sellerIdx: 1, title: "PSA-graded Singles Showcase", coverIdx: 1, items: 5 },
  ];

  const cardPool = [
    "Charizard V",
    "Pikachu Promo",
    "Mew EX",
    "Mewtwo V",
    "Lugia V",
    "Rayquaza VMAX",
    "Eevee Promo",
    "Vaporeon V",
    "Jolteon V",
    "Flareon V",
    "Espeon V",
    "Umbreon V-MAX",
    "Sylveon V",
    "Snorlax",
    "Gengar VMAX",
    "Blastoise Base",
    "Venusaur Base",
    "Alakazam Base",
    "Zapdos Fossil",
    "Articuno Fossil",
    "Moltres Fossil",
    "Garchomp V",
    "Greninja Star",
    "Magikarp Promo",
    "Gyarados Promo",
    "Dragonite V",
    "Eternatus V",
    "Lucario V",
    "Cynthia's Garchomp",
    "Iono Trainer",
  ];
  const cardConditions = ["Near Mint", "Lightly Played", "Moderately Played"];

  for (const s of claimsaleSpecs) {
    const seller = sellers[s.sellerIdx];
    const methods = shippingForSeller(s.sellerIdx);
    const cheapest = methods[0];

    const claimsale = await prisma.claimsale.create({
      data: {
        title: s.title,
        description: `Claimsale van ${seller.displayName}. Eerste-komt-eerst-maalt: claim wat je wilt en betaal via één enkele verzending.`,
        coverImage: img(s.coverIdx),
        shippingCost: cheapest?.price ?? 5.0,
        status: "LIVE",
        publishedAt: new Date(now.getTime() - rand(1, 14) * 24 * 3600_000),
        sellerId: seller.id,
      },
    });

    if (methods.length > 0) {
      await prisma.claimsaleShippingMethod.createMany({
        data: methods.map((m) => ({
          claimsaleId: claimsale.id,
          shippingMethodId: m.id,
          price: m.price,
        })),
      });
    }

    await prisma.claimsaleItem.createMany({
      data: Array.from({ length: s.items }, (_, i) => ({
        cardName: pick(cardPool, i * 3 + s.coverIdx),
        condition: pick(cardConditions, i + s.coverIdx),
        price: randFloat(2.5, 95),
        reference: `#${rand(1, 250)}`,
        imageUrls: imgJson(s.coverIdx + i, 1),
        claimsaleId: claimsale.id,
        status: "AVAILABLE",
      })),
    });
  }
  console.log(`  ✓ ${claimsaleSpecs.length} claimsales (totaal ~${claimsaleSpecs.reduce((a, b) => a + b.items, 0)} items)\n`);

  // ====================================================================
  // WATCHLIST — voor beide gmail-accounts
  // ====================================================================
  console.log("Creating watchlist entries...");
  const yourivk = buyers.find((b) => b.email === "yourivankerkhoven@gmail.com")!;
  const beppo = buyers.find((b) => b.email === "youribeppo@gmail.com")!;

  const watchAuctions = createdAuctions.slice(0, 4);
  const watchListings = await prisma.listing.findMany({
    where: { sellerId: { in: sellers.map((s) => s.id) }, status: "ACTIVE" },
    take: 4,
    orderBy: { createdAt: "desc" },
    select: { id: true, sellerId: true },
  });
  const watchClaimsales = await prisma.claimsale.findMany({
    where: { sellerId: { in: sellers.map((s) => s.id) }, status: "LIVE" },
    take: 3,
    orderBy: { createdAt: "desc" },
    select: { id: true, sellerId: true },
  });

  let watchlistCount = 0;
  for (const user of [yourivk, beppo]) {
    for (const a of watchAuctions) {
      const auction = await prisma.auction.findUnique({
        where: { id: a.id },
        select: { sellerId: true },
      });
      if (auction!.sellerId === user.id) continue;
      try {
        await prisma.watchlist.create({ data: { userId: user.id, auctionId: a.id } });
        watchlistCount++;
      } catch {
        /* unique violation — already watching, skip */
      }
    }
    for (const l of watchListings) {
      if (l.sellerId === user.id) continue;
      try {
        await prisma.watchlist.create({ data: { userId: user.id, listingId: l.id } });
        watchlistCount++;
      } catch {
        /* skip */
      }
    }
    for (const c of watchClaimsales) {
      if (c.sellerId === user.id) continue;
      try {
        await prisma.watchlist.create({ data: { userId: user.id, claimsaleId: c.id } });
        watchlistCount++;
      } catch {
        /* skip */
      }
    }
  }
  console.log(`  ✓ ${watchlistCount} watchlist entries\n`);

  // ====================================================================
  // COMPLETED PURCHASE / SALE — 1 bundle voor "youribeppo" als koper
  // ====================================================================
  console.log("Creating completed purchase/sale...");
  const fixedListing = await prisma.listing.findFirst({
    where: {
      pricingType: "FIXED",
      deliveryMethod: "SHIP",
      status: "ACTIVE",
      sellerId: { in: sellers.slice(0, 6).map((s) => s.id) }, // niet eigen gmail-account
    },
    orderBy: { createdAt: "desc" },
  });

  if (fixedListing) {
    const seller = await prisma.user.findUniqueOrThrow({ where: { id: fixedListing.sellerId } });
    const method = await prisma.sellerShippingMethod.findFirst({
      where: {
        sellerId: seller.id,
        isActive: true,
        service: "PARCEL_STANDARD",
        zone: "DOMESTIC",
      },
    });
    const shipPrice = method
      ? effectivePrice(method as any, seller.country ?? "NL")
      : 7.85;
    const itemTotal = fixedListing.price ?? 50;

    const bundle = await prisma.shippingBundle.create({
      data: {
        orderNumber: genOrderNumber(),
        buyerId: beppo.id,
        sellerId: seller.id,
        listingId: fixedListing.id,
        shippingCost: shipPrice,
        totalItemCost: itemTotal,
        totalCost: itemTotal + shipPrice,
        shippingMethodId: method?.id,
        status: "COMPLETED",
        paymentMode: "PLATFORM",
        deliveryMethod: "SHIP",
        buyerStreet: "Teststraat",
        buyerHouseNumber: "12B",
        buyerPostalCode: "1011 AB",
        buyerCity: "Amsterdam",
        buyerCountry: "NL",
        shippedAt: new Date(now.getTime() - 7 * 24 * 3600_000),
        deliveredAt: new Date(now.getTime() - 3 * 24 * 3600_000),
        trackingUrl: "https://postnl.nl/track-en-trace/3STEST1234567",
        createdAt: new Date(now.getTime() - 10 * 24 * 3600_000),
      },
    });

    await prisma.listing.update({
      where: { id: fixedListing.id },
      data: { status: "SOLD", buyerId: beppo.id },
    });

    console.log(
      `  ✓ Completed sale: "${fixedListing.title}" → bundle ${bundle.orderNumber} (buyer beppo, seller ${seller.displayName})\n`
    );
  } else {
    console.log("  ⚠ Geen geschikte listing gevonden voor completed-sale demo\n");
  }

  // ====================================================================
  // NOTIFICATIONS — 4+3 voor beide gmail-accounts
  // ====================================================================
  console.log("Creating notifications...");
  const notifSpec: Array<{
    userId: string;
    type: string;
    title: string;
    body: string;
    link: string;
    read: boolean;
    hoursAgo: number;
  }> = [
    { userId: yourivk.id, type: "OUTBID", title: "Je bent overboden", body: "Iemand heeft je bod op 'Charizard 1st Edition Base' overboden. Plaats een nieuw bod om in de race te blijven.", link: "/dashboard/biedingen", read: false, hoursAgo: 2 },
    { userId: yourivk.id, type: "WATCHLIST_ENDING", title: "Veiling loopt bijna af", body: "'Mewtwo & Mew GX Tag Team' op je volglijst loopt af binnen 24u.", link: "/dashboard/volglijst", read: false, hoursAgo: 6 },
    { userId: yourivk.id, type: "NEW_MESSAGE", title: "Nieuw bericht", body: "Je hebt een nieuw bericht van PikachuTrader over een listing.", link: "/berichten", read: false, hoursAgo: 12 },
    { userId: yourivk.id, type: "AUCTION_WON", title: "🎉 Veiling gewonnen!", body: "Gefeliciteerd, je hebt 'Lot 8× Energy Reverse Holo's' gewonnen voor €18.", link: "/dashboard/aankopen", read: true, hoursAgo: 36 },
    { userId: beppo.id, type: "ITEM_SOLD", title: "Item verkocht!", body: "Iemand heeft 'Pokémon Playmat XL' van je gekocht.", link: "/dashboard/verkopen", read: false, hoursAgo: 4 },
    { userId: beppo.id, type: "NEW_MESSAGE", title: "Nieuw bericht", body: "Je hebt een nieuw bericht over een bundle-aanbod.", link: "/berichten", read: false, hoursAgo: 9 },
    { userId: beppo.id, type: "OUTBID", title: "Je bent overboden", body: "Iemand heeft je bod op 'Lugia V Alt Art' overboden.", link: "/dashboard/biedingen", read: false, hoursAgo: 18 },
  ];
  for (const n of notifSpec) {
    await prisma.notification.create({
      data: {
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        read: n.read,
        createdAt: new Date(now.getTime() - n.hoursAgo * 3600_000),
      },
    });
  }
  console.log(`  ✓ ${notifSpec.length} notifications (${notifSpec.filter((n) => !n.read).length} ongelezen)\n`);

  // ====================================================================
  // SUMMARY
  // ====================================================================
  const finalCounts = await Promise.all([
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.auction.count({ where: { status: { in: ["ACTIVE", "SCHEDULED"] } } }),
    prisma.claimsale.count({ where: { status: "LIVE" } }),
    prisma.auctionBid.count(),
    prisma.watchlist.count(),
    prisma.notification.count({ where: { read: false } }),
  ]);
  console.log("=== DB-totals (na seed) ===");
  console.log(`  ACTIVE listings:        ${finalCounts[0]}`);
  console.log(`  ACTIVE+SCHEDULED auctions: ${finalCounts[1]}`);
  console.log(`  LIVE claimsales:        ${finalCounts[2]}`);
  console.log(`  Total bids:             ${finalCounts[3]}`);
  console.log(`  Watchlist items:        ${finalCounts[4]}`);
  console.log(`  Unread notifications:   ${finalCounts[5]}`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
