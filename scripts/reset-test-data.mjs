import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const ATOMICSNIPZ_ID = "cmnap9tic000issg14qlg289t";

// Seller IDs for test auctions
const SELLERS = [
  "cmnaou9up0000e8g1tqdyhvuv", // PikaFan_NL
  "cmnaou9va0001e8g1o12j02n2", // CharizardKing
  "cmnaou9vj0002e8g1ig4l53lo", // TrainerMax
  "cmnaou9vs0003e8g1oev5fx31", // VintageCards_Amsterdam
  "cmnaou9w10004e8g17efxao6k", // SetCompleter
  "cmnaou9wa0005e8g1r3aiou1e", // ShinyHunter99
  "cmnaou9wj0006e8g1t7jcnrfy", // TCGDeals_Rotterdam
  "cmnaou9wr0007e8g1xrmvdcl0", // MewtwoCollector
  "cmnaou9x10008e8g1eakvp1gq", // EeveeFanatic
  "cmnaou9xa0009e8g13rqaek6n", // BoosterBreaker
];

// Get IDs of sponsored auctions (to keep)
const sponsoredAuctions = await prisma.auction.findMany({
  where: {
    upsells: { some: { type: "CATEGORY_HIGHLIGHT" } },
  },
  select: { id: true },
});
const sponsoredIds = sponsoredAuctions.map((a) => a.id);
console.log(`Keeping ${sponsoredIds.length} sponsored auctions`);

// Delete non-sponsored auctions (and their related data)
const nonSponsored = await prisma.auction.findMany({
  where: { id: { notIn: sponsoredIds } },
  select: { id: true },
});
const nonSponsoredIds = nonSponsored.map((a) => a.id);
console.log(`Deleting ${nonSponsoredIds.length} non-sponsored auctions...`);

if (nonSponsoredIds.length > 0) {
  await prisma.auctionBid.deleteMany({ where: { auctionId: { in: nonSponsoredIds } } });
  await prisma.autoBid.deleteMany({ where: { auctionId: { in: nonSponsoredIds } } });
  await prisma.auctionUpsell.deleteMany({ where: { auctionId: { in: nonSponsoredIds } } });
  await prisma.auctionShippingMethod.deleteMany({ where: { auctionId: { in: nonSponsoredIds } } });
  await prisma.watchlist.deleteMany({ where: { auctionId: { in: nonSponsoredIds } } });
  await prisma.auction.deleteMany({ where: { id: { in: nonSponsoredIds } } });
}

// Reset atomicsnipz
console.log("Resetting atomicsnipz...");

// Delete shipping bundles where atomicsnipz is buyer or seller
const bundles = await prisma.shippingBundle.findMany({
  where: { OR: [{ buyerId: ATOMICSNIPZ_ID }, { sellerId: ATOMICSNIPZ_ID }] },
  select: { id: true },
});
const bundleIds = bundles.map((b) => b.id);
if (bundleIds.length > 0) {
  // Delete dispute events first, then disputes
  const disputes = await prisma.dispute.findMany({ where: { shippingBundleId: { in: bundleIds } }, select: { id: true } });
  const disputeIds = disputes.map((d) => d.id);
  if (disputeIds.length > 0) {
    await prisma.disputeEvent.deleteMany({ where: { disputeId: { in: disputeIds } } });
    await prisma.dispute.deleteMany({ where: { id: { in: disputeIds } } });
  }
  await prisma.shippingBundle.deleteMany({ where: { id: { in: bundleIds } } });
}

// Delete transactions for atomicsnipz
await prisma.transaction.deleteMany({ where: { userId: ATOMICSNIPZ_ID } });

// Delete bids by atomicsnipz
await prisma.auctionBid.deleteMany({ where: { bidderId: ATOMICSNIPZ_ID } });
await prisma.autoBid.deleteMany({ where: { userId: ATOMICSNIPZ_ID } });

// Delete reviews by/for atomicsnipz
await prisma.review.deleteMany({ where: { OR: [{ reviewerId: ATOMICSNIPZ_ID }, { sellerId: ATOMICSNIPZ_ID }] } });

// Reset balance
await prisma.user.update({
  where: { id: ATOMICSNIPZ_ID },
  data: { balance: 250, reservedBalance: 0, heldBalance: 0 },
});
console.log("atomicsnipz reset: balance=250, reserved=0, held=0");

// Create new test auctions of all types
console.log("Creating test auctions...");

const now = new Date();
function futureDate(days) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

const testAuctions = [
  // SINGLE_CARD auctions
  {
    title: "Charizard VSTAR Rainbow Rare — Crown Zenith",
    auctionType: "SINGLE_CARD",
    sellerId: SELLERS[0],
    startingBid: 25,
    currentBid: 47.50,
    duration: 7,
    endTime: futureDate(5),
    cardName: "Charizard VSTAR",
    condition: "Near Mint",
    description: "Prachtige rainbow rare Charizard VSTAR uit Crown Zenith. Kaart is direct uit booster in sleeve gegaan.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },
  {
    title: "Pikachu V Full Art — Lost Origin",
    auctionType: "SINGLE_CARD",
    sellerId: SELLERS[1],
    startingBid: 8,
    currentBid: 12.50,
    duration: 5,
    endTime: futureDate(2),
    cardName: "Pikachu V",
    condition: "Mint",
    description: "Full art Pikachu V uit Lost Origin. Perfect centered, geen whitening.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },
  {
    title: "Mew ex SAR — Pokémon 151",
    auctionType: "SINGLE_CARD",
    sellerId: SELLERS[2],
    startingBid: 45,
    currentBid: null,
    duration: 7,
    endTime: futureDate(6),
    cardName: "Mew ex",
    condition: "Near Mint",
    description: "Special Art Rare Mew ex uit de 151 set. Meteen gesleevd, top conditie.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },
  {
    title: "Eevee Heroes Espeon VMAX Alt Art",
    auctionType: "SINGLE_CARD",
    sellerId: SELLERS[3],
    startingBid: 120,
    currentBid: 185,
    duration: 14,
    endTime: futureDate(1),
    cardName: "Espeon VMAX",
    condition: "Near Mint",
    description: "Japanse Espeon VMAX alternate art uit Eevee Heroes. Absoluut prachtige illustratie.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
    buyNowPrice: 280,
  },
  {
    title: "Gengar ex SAR — Obsidian Flames",
    auctionType: "SINGLE_CARD",
    sellerId: SELLERS[4],
    startingBid: 30,
    currentBid: 30,
    duration: 3,
    endTime: futureDate(0.1), // ending very soon
    cardName: "Gengar ex",
    condition: "Mint",
    description: "Gengar ex Special Art Rare. Vers uit de booster, perfecte staat.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },

  // MULTI_CARD auctions
  {
    title: "10x Trainer Gallery kaarten — Lost Origin & Silver Tempest",
    auctionType: "MULTI_CARD",
    sellerId: SELLERS[5],
    startingBid: 15,
    currentBid: 22,
    duration: 7,
    endTime: futureDate(4),
    estimatedCardCount: 10,
    description: "Bundel van 10 Trainer Gallery kaarten uit Lost Origin en Silver Tempest. Allemaal NM/Mint.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },
  {
    title: "25x Reverse Holo bundel — Scarlet & Violet era",
    auctionType: "MULTI_CARD",
    sellerId: SELLERS[6],
    startingBid: 5,
    currentBid: 8.50,
    duration: 5,
    endTime: futureDate(3),
    estimatedCardCount: 25,
    description: "25 reverse holo kaarten uit diverse Scarlet & Violet sets. Leuk voor verzamelaars!",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },
  {
    title: "50x V/VMAX/VSTAR kaarten bundel",
    auctionType: "MULTI_CARD",
    sellerId: SELLERS[7],
    startingBid: 35,
    currentBid: null,
    duration: 7,
    endTime: futureDate(7),
    estimatedCardCount: 50,
    description: "Grote bundel van 50 V, VMAX en VSTAR kaarten. Mix van Engelse en Japanse kaarten.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
    buyNowPrice: 65,
  },

  // COLLECTION auctions
  {
    title: "Complete Base Set — 102/102 kaarten",
    auctionType: "COLLECTION",
    sellerId: SELLERS[8],
    startingBid: 800,
    currentBid: 1250,
    duration: 14,
    endTime: futureDate(10),
    estimatedCardCount: 102,
    conditionRange: "Light Play - Near Mint",
    description: "Volledige originele Base Set inclusief Charizard, Blastoise en Venusaur holos. Verzameld in de jaren 90.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },
  {
    title: "Pokémon 151 Master Set — alle regulars + reverses",
    auctionType: "COLLECTION",
    sellerId: SELLERS[9],
    startingBid: 200,
    currentBid: 310,
    duration: 7,
    endTime: futureDate(5),
    estimatedCardCount: 332,
    conditionRange: "Near Mint - Mint",
    description: "Complete master set van Pokémon 151. Alle common, uncommon, rare, holo en reverse holo kaarten.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
    buyNowPrice: 450,
  },

  // SEALED_PRODUCT auctions
  {
    title: "Pokémon 151 Elite Trainer Box — Sealed",
    auctionType: "SEALED_PRODUCT",
    sellerId: SELLERS[0],
    startingBid: 55,
    currentBid: 72,
    duration: 5,
    endTime: futureDate(3),
    productType: "Elite Trainer Box",
    description: "Factory sealed Pokémon 151 ETB. Shrink wrap intact, geen deuken.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },
  {
    title: "Surging Sparks Booster Box — 36 packs",
    auctionType: "SEALED_PRODUCT",
    sellerId: SELLERS[1],
    startingBid: 120,
    currentBid: null,
    duration: 7,
    endTime: futureDate(6),
    productType: "Booster Box",
    description: "Sealed booster box Surging Sparks. 36 packs, perfect als investering of om te openen!",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
    buyNowPrice: 160,
  },
  {
    title: "Charizard ex Premium Collection Box — Sealed",
    auctionType: "SEALED_PRODUCT",
    sellerId: SELLERS[2],
    startingBid: 40,
    currentBid: 52,
    duration: 3,
    endTime: futureDate(1),
    productType: "Premium Collection",
    description: "Sealed Charizard ex Premium Collection. Bevat 6 boosters en promo Charizard ex.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },

  // OTHER auctions
  {
    title: "Custom Pokémon kaarten opbergmap — 480 slots",
    auctionType: "OTHER",
    sellerId: SELLERS[3],
    startingBid: 10,
    currentBid: 14,
    duration: 5,
    endTime: futureDate(2),
    itemCategory: "Accessoires",
    description: "Hoogwaardige opbergmap met 480 slots voor Pokémon kaarten. Zijlading, anti-kras binnenkant.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },
  {
    title: "Pikachu FUNKO POP #353 — A Day with Pikachu",
    auctionType: "OTHER",
    sellerId: SELLERS[4],
    startingBid: 25,
    currentBid: null,
    duration: 7,
    endTime: futureDate(7),
    itemCategory: "Figuren",
    description: "Zeldzame Pikachu Funko Pop uit de 'A Day with Pikachu' serie. In originele verpakking.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
    buyNowPrice: 45,
  },
  {
    title: "Pokémon TCG speelmat — Eeveelutions artwork",
    auctionType: "OTHER",
    sellerId: SELLERS[5],
    startingBid: 15,
    currentBid: 18,
    duration: 5,
    endTime: futureDate(4),
    itemCategory: "Accessoires",
    description: "Officiële Pokémon TCG speelmat met alle Eeveelutions. Rubber onderkant, stof bovenkant.",
    imageUrls: JSON.stringify(["/placeholder-card.jpg"]),
  },
];

// Create auctions with bids
for (const data of testAuctions) {
  const { currentBid, buyNowPrice, ...auctionData } = data;

  const auction = await prisma.auction.create({
    data: {
      ...auctionData,
      status: "ACTIVE",
      currentBid,
      buyNowPrice: buyNowPrice ?? null,
      createdAt: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Add some fake bids for auctions with currentBid
  if (currentBid) {
    const bidCount = Math.floor(Math.random() * 8) + 1;
    const bidIncrement = (currentBid - data.startingBid) / bidCount;
    for (let i = 0; i < bidCount; i++) {
      const bidderIdx = Math.floor(Math.random() * SELLERS.length);
      // Don't let seller bid on own auction
      const bidderId = SELLERS[bidderIdx] === data.sellerId
        ? SELLERS[(bidderIdx + 1) % SELLERS.length]
        : SELLERS[bidderIdx];
      await prisma.auctionBid.create({
        data: {
          auctionId: auction.id,
          bidderId,
          amount: Math.round((data.startingBid + bidIncrement * (i + 1)) * 100) / 100,
          createdAt: new Date(now.getTime() - (bidCount - i) * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log(`  Created: ${data.title} (${data.auctionType})`);
}

console.log("\nDone! Summary:");
const total = await prisma.auction.count({ where: { status: "ACTIVE" } });
console.log(`  Total active auctions: ${total}`);
const user = await prisma.user.findUnique({ where: { id: ATOMICSNIPZ_ID }, select: { balance: true, reservedBalance: true, heldBalance: true } });
console.log(`  atomicsnipz: balance=${user.balance}, reserved=${user.reservedBalance}, held=${user.heldBalance}`);

await prisma.$disconnect();
