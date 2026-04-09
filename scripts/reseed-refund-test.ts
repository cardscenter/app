import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

function genOrder(date: Date): string {
  const d = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  return `ORD-${d}-${String(Math.floor(Math.random()*9000)+1000)}`;
}

async function main() {
  const me = await prisma.user.findFirst({ where: { email: "yourivankerkhoven@gmail.com" } });
  if (!me) { console.error("User not found"); return; }

  const bots = await prisma.user.findMany({
    where: { email: { not: "yourivankerkhoven@gmail.com" } },
    take: 8,
  });

  if (bots.length < 6) { console.error("Not enough bot users"); return; }

  // Delete old test bundles
  const oldBundles = await prisma.shippingBundle.findMany({
    where: { OR: [{ buyerId: me.id }, { sellerId: me.id }] },
    select: { id: true },
  });
  for (const b of oldBundles) {
    await prisma.claimsaleItem.updateMany({ where: { shippingBundleId: b.id }, data: { shippingBundleId: null, buyerId: null, status: "AVAILABLE", refundedAt: null } });
    await prisma.dispute.deleteMany({ where: { shippingBundleId: b.id } });
  }
  await prisma.shippingBundle.deleteMany({
    where: { OR: [{ buyerId: me.id }, { sellerId: me.id }] },
  });
  console.log(`Deleted ${oldBundles.length} old bundles`);

  const now = new Date();
  const day = 86400000;

  // ==========================================
  // SALES (me = seller)
  // ==========================================
  console.log("\n💰 SALES (jij bent de verkoper):\n");

  // --- SALE 1: PAID — Claimsale 5 items ---
  const cs1 = await prisma.claimsale.create({
    data: {
      title: "Base Set NM Collection",
      description: "5 Near Mint Base Set kaarten",
      status: "LIVE", sellerId: me.id, shippingCost: 4.95,
      coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const sale1 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[0].id, sellerId: me.id,
      shippingCost: 4.95, totalItemCost: 62.50, totalCost: 67.45, status: "PAID",
      buyerStreet: "Herengracht", buyerHouseNumber: "42",
      buyerPostalCode: "1015BN", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  for (const item of [
    { cardName: "Charizard Base Set #4", condition: "Near Mint", price: 22.00 },
    { cardName: "Blastoise Base Set #2", condition: "Near Mint", price: 14.00 },
    { cardName: "Venusaur Base Set #15", condition: "Lightly Played", price: 11.50 },
    { cardName: "Pikachu Base Set #58", condition: "Near Mint", price: 8.00 },
    { cardName: "Mewtwo Base Set #10", condition: "Near Mint", price: 7.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: { claimsaleId: cs1.id, cardName: item.cardName, condition: item.condition, price: item.price, imageUrls: "[]", status: "SOLD", buyerId: bots[0].id, shippingBundleId: sale1.id },
    });
  }
  console.log(`  ${sale1.orderNumber} PAID — Claimsale 5 items €67.45 (${bots[0].displayName})`);

  // --- SALE 2: PAID — Listing ---
  const listing1 = await prisma.listing.create({
    data: {
      title: "Moonbreon VMAX Alt Art #215",
      description: "Pristine alt art card",
      imageUrls: "[]", price: 149.99, condition: "Mint",
      status: "SOLD", sellerId: me.id, buyerId: bots[1].id,
      listingType: "SINGLE_CARD", pricingType: "FIXED",
    },
  });
  const sale2 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[1].id, sellerId: me.id,
      shippingCost: 6.95, totalItemCost: 149.99, totalCost: 156.94, status: "PAID",
      listingId: listing1.id,
      buyerStreet: "Keizersgracht", buyerHouseNumber: "100",
      buyerPostalCode: "1015AA", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  console.log(`  ${sale2.orderNumber} PAID — Listing €156.94 (${bots[1].displayName})`);

  // --- SALE 3: SHIPPED — Claimsale 6 items (voor refund test) ---
  const cs2 = await prisma.claimsale.create({
    data: {
      title: "Japanese Promos & Hits",
      description: "6 Japanese promo kaarten",
      status: "LIVE", sellerId: me.id, shippingCost: 6.50,
      coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const sale3 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[2].id, sellerId: me.id,
      shippingCost: 6.50, totalItemCost: 87.00, totalCost: 93.50, status: "SHIPPED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST654321",
      shippedAt: new Date(now.getTime() - 2 * day),
      buyerStreet: "Prinsengracht", buyerHouseNumber: "263",
      buyerPostalCode: "1016GV", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  for (const item of [
    { cardName: "Mew ex (JP Promo #151)", condition: "Mint", price: 22.00 },
    { cardName: "Mewtwo V (JP Promo)", condition: "Near Mint", price: 15.00 },
    { cardName: "Rayquaza VMAX (JP Alt Art)", condition: "Near Mint", price: 18.00 },
    { cardName: "Pikachu V (JP Full Art)", condition: "Mint", price: 12.00 },
    { cardName: "Gengar VMAX (JP)", condition: "Lightly Played", price: 10.00 },
    { cardName: "Umbreon V (JP Promo)", condition: "Near Mint", price: 10.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: { claimsaleId: cs2.id, cardName: item.cardName, condition: item.condition, price: item.price, imageUrls: "[]", status: "SOLD", buyerId: bots[2].id, shippingBundleId: sale3.id },
    });
  }
  console.log(`  ${sale3.orderNumber} SHIPPED — Claimsale 6 items €93.50 (${bots[2].displayName})`);

  // --- SALE 4: SHIPPED — Claimsale 3 items (1 al gerefund) ---
  const cs3 = await prisma.claimsale.create({
    data: {
      title: "Scarlet & Violet Hits",
      description: "3 SV hits",
      status: "LIVE", sellerId: me.id, shippingCost: 4.95,
      coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const sale4 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[3].id, sellerId: me.id,
      shippingCost: 4.95, totalItemCost: 45.00, totalCost: 49.95, status: "SHIPPED",
      refundedAmount: 15.00,
      trackingUrl: "https://postnl.nl/tracktrace/3STEST112233",
      shippedAt: new Date(now.getTime() - 4 * day),
      buyerStreet: "Damstraat", buyerHouseNumber: "12",
      buyerPostalCode: "1012JM", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  const s4items = [
    { cardName: "Charizard ex SV3pt5 #199", condition: "Mint", price: 20.00, refunded: false },
    { cardName: "Miraidon ex SV1 #081", condition: "Near Mint", price: 15.00, refunded: true },
    { cardName: "Koraidon ex SV1 #124", condition: "Near Mint", price: 10.00, refunded: false },
  ];
  for (const item of s4items) {
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: cs3.id, cardName: item.cardName, condition: item.condition, price: item.price,
        imageUrls: "[]", status: "SOLD", buyerId: bots[3].id, shippingBundleId: sale4.id,
        refundedAt: item.refunded ? new Date(now.getTime() - 1 * day) : null,
      },
    });
  }
  console.log(`  ${sale4.orderNumber} SHIPPED — Claimsale 3 items (1 refunded) €49.95 (${bots[3].displayName})`);

  // --- SALE 5: SHIPPED — Auction ---
  const auction1 = await prisma.auction.create({
    data: {
      title: "Gold Star Metagross ex Delta Species",
      description: "Rare gold star card",
      imageUrls: "[]", currentBid: 185.00, finalPrice: 185.00,
      condition: "Near Mint", status: "ENDED_SOLD", auctionType: "SINGLE_CARD",
      startingBid: 50.00, sellerId: me.id, winnerId: bots[4].id,
      endTime: new Date(now.getTime() - 5 * day), duration: 7, paymentStatus: "PAID",
    },
  });
  const sale5 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[4].id, sellerId: me.id,
      shippingCost: 6.95, totalItemCost: 185.00, totalCost: 191.95, status: "SHIPPED",
      auctionId: auction1.id,
      trackingUrl: "https://postnl.nl/tracktrace/3STEST998877",
      shippedAt: new Date(now.getTime() - 3 * day),
      buyerStreet: "Oudezijds Voorburgwal", buyerHouseNumber: "55",
      buyerPostalCode: "1012EJ", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  console.log(`  ${sale5.orderNumber} SHIPPED — Auction €191.95 (${bots[4].displayName})`);

  // --- SALE 6: SHIPPED — Listing ---
  const listing2 = await prisma.listing.create({
    data: {
      title: "PSA 9 Charizard VSTAR Rainbow",
      description: "Graded card in perfect condition",
      imageUrls: "[]", price: 75.00, condition: "Mint",
      status: "SOLD", sellerId: me.id, buyerId: bots[5].id,
      listingType: "SINGLE_CARD", pricingType: "FIXED",
    },
  });
  const sale6 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[5].id, sellerId: me.id,
      shippingCost: 8.95, totalItemCost: 75.00, totalCost: 83.95, status: "SHIPPED",
      listingId: listing2.id,
      trackingUrl: "https://postnl.nl/tracktrace/3STEST445566",
      shippedAt: new Date(now.getTime() - 1 * day),
      buyerStreet: "Vijzelstraat", buyerHouseNumber: "88",
      buyerPostalCode: "1017HN", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  console.log(`  ${sale6.orderNumber} SHIPPED — Listing €83.95 (${bots[5].displayName})`);

  // --- SALE 7: COMPLETED — Claimsale 4 items ---
  const cs4 = await prisma.claimsale.create({
    data: {
      title: "Neo Genesis Holos",
      description: "4 holo kaarten van Neo Genesis",
      status: "LIVE", sellerId: me.id, shippingCost: 4.95,
      coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const sale7 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(new Date(now.getTime() - 14 * day)), buyerId: bots[0].id, sellerId: me.id,
      shippingCost: 4.95, totalItemCost: 95.00, totalCost: 99.95, status: "COMPLETED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST111222",
      shippedAt: new Date(now.getTime() - 14 * day),
      deliveredAt: new Date(now.getTime() - 9 * day),
      buyerStreet: "Herengracht", buyerHouseNumber: "42",
      buyerPostalCode: "1015BN", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  for (const item of [
    { cardName: "Typhlosion Neo Genesis #17", condition: "Near Mint", price: 28.00 },
    { cardName: "Feraligatr Neo Genesis #5", condition: "Lightly Played", price: 22.00 },
    { cardName: "Meganium Neo Genesis #10", condition: "Near Mint", price: 25.00 },
    { cardName: "Lugia Neo Genesis #9", condition: "Moderately Played", price: 20.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: { claimsaleId: cs4.id, cardName: item.cardName, condition: item.condition, price: item.price, imageUrls: "[]", status: "SOLD", buyerId: bots[0].id, shippingBundleId: sale7.id },
    });
  }
  console.log(`  ${sale7.orderNumber} COMPLETED — Claimsale 4 items €99.95 (${bots[0].displayName})`);

  // --- SALE 8: COMPLETED — Auction ---
  const auction2 = await prisma.auction.create({
    data: {
      title: "Ancient Mew Promo Card",
      description: "Movie promo sealed", imageUrls: "[]",
      currentBid: 35.00, finalPrice: 35.00, condition: "Mint",
      status: "ENDED_SOLD", auctionType: "SINGLE_CARD", startingBid: 10.00,
      sellerId: me.id, winnerId: bots[1].id,
      endTime: new Date(now.getTime() - 20 * day), duration: 5, paymentStatus: "PAID",
    },
  });
  const sale8 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(new Date(now.getTime() - 18 * day)), buyerId: bots[1].id, sellerId: me.id,
      shippingCost: 4.95, totalItemCost: 35.00, totalCost: 39.95, status: "COMPLETED",
      auctionId: auction2.id,
      trackingUrl: "https://postnl.nl/tracktrace/3STEST333444",
      shippedAt: new Date(now.getTime() - 18 * day),
      deliveredAt: new Date(now.getTime() - 12 * day),
      buyerStreet: "Keizersgracht", buyerHouseNumber: "100",
      buyerPostalCode: "1015AA", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  console.log(`  ${sale8.orderNumber} COMPLETED — Auction €39.95 (${bots[1].displayName})`);

  // --- SALE 9: CANCELLED ---
  const sale9 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(new Date(now.getTime() - 10 * day)), buyerId: bots[2].id, sellerId: me.id,
      shippingCost: 4.95, totalItemCost: 15.00, totalCost: 19.95, status: "CANCELLED",
      buyerStreet: "Prinsengracht", buyerHouseNumber: "263",
      buyerPostalCode: "1016GV", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  console.log(`  ${sale9.orderNumber} CANCELLED — €19.95 (${bots[2].displayName})`);

  // ==========================================
  // PURCHASES (me = buyer)
  // ==========================================
  console.log("\n📦 PURCHASES (jij bent de koper):\n");

  // --- PURCHASE 1: PAID — Claimsale 3 items ---
  const cs5 = await prisma.claimsale.create({
    data: {
      title: "Paldea Evolved Hits",
      description: "3 Paldea Evolved hits",
      status: "LIVE", sellerId: bots[0].id, shippingCost: 4.95,
      coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const purchase1 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: me.id, sellerId: bots[0].id,
      shippingCost: 4.95, totalItemCost: 42.50, totalCost: 47.45, status: "PAID",
      buyerStreet: me.street!, buyerHouseNumber: me.houseNumber,
      buyerPostalCode: me.postalCode!, buyerCity: me.city!, buyerCountry: me.country,
    },
  });
  for (const item of [
    { cardName: "Ting-Lu ex PAL #127", condition: "Mint", price: 16.00 },
    { cardName: "Wo-Chien ex PAL #093", condition: "Near Mint", price: 14.50 },
    { cardName: "Chien-Pao ex PAL #061", condition: "Near Mint", price: 12.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: { claimsaleId: cs5.id, cardName: item.cardName, condition: item.condition, price: item.price, imageUrls: "[]", status: "SOLD", buyerId: me.id, shippingBundleId: purchase1.id },
    });
  }
  console.log(`  ${purchase1.orderNumber} PAID — Claimsale 3 items €47.45 (${bots[0].displayName})`);

  // --- PURCHASE 2: PAID (>7 days, cancellable) — Auction ---
  const auction3 = await prisma.auction.create({
    data: {
      title: "Pikachu VMAX Rainbow Rare",
      description: "Beautiful rainbow rare", imageUrls: "[]",
      currentBid: 22.00, finalPrice: 22.00, condition: "Near Mint",
      status: "ENDED_SOLD", auctionType: "SINGLE_CARD", startingBid: 5.00,
      sellerId: bots[1].id, winnerId: me.id,
      endTime: new Date(now.getTime() - 9 * day), duration: 7, paymentStatus: "PAID",
    },
  });
  const purchase2 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(new Date(now.getTime() - 8 * day)), buyerId: me.id, sellerId: bots[1].id,
      shippingCost: 3.50, totalItemCost: 22.00, totalCost: 25.50, status: "PAID",
      auctionId: auction3.id,
      createdAt: new Date(now.getTime() - 8 * day),
      buyerStreet: me.street!, buyerHouseNumber: me.houseNumber,
      buyerPostalCode: me.postalCode!, buyerCity: me.city!, buyerCountry: me.country,
    },
  });
  console.log(`  ${purchase2.orderNumber} PAID (cancellable) — Auction €25.50 (${bots[1].displayName})`);

  // --- PURCHASE 3: SHIPPED — Listing ---
  const listing3 = await prisma.listing.create({
    data: {
      title: "Eevee Heroes Booster Box (JP)",
      description: "Sealed Japanese booster box", imageUrls: "[]",
      price: 67.50, condition: "Mint", status: "SOLD",
      sellerId: bots[2].id, buyerId: me.id,
      listingType: "SEALED_PRODUCT", pricingType: "FIXED",
    },
  });
  const purchase3 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: me.id, sellerId: bots[2].id,
      shippingCost: 4.95, totalItemCost: 67.50, totalCost: 72.45, status: "SHIPPED",
      listingId: listing3.id,
      trackingUrl: "https://postnl.nl/tracktrace/3STEST555777",
      shippedAt: new Date(now.getTime() - 5 * day),
      buyerStreet: me.street!, buyerHouseNumber: me.houseNumber,
      buyerPostalCode: me.postalCode!, buyerCity: me.city!, buyerCountry: me.country,
    },
  });
  console.log(`  ${purchase3.orderNumber} SHIPPED — Listing €72.45 (${bots[2].displayName})`);

  // --- PURCHASE 4: SHIPPED (dispute-eligible >10d) — Claimsale 4 items ---
  const cs6 = await prisma.claimsale.create({
    data: {
      title: "Vintage Bulk Lot",
      description: "Mixed vintage lot", status: "LIVE",
      sellerId: bots[3].id, shippingCost: 6.95,
      coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const purchase4 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: me.id, sellerId: bots[3].id,
      shippingCost: 6.95, totalItemCost: 120.00, totalCost: 126.95, status: "SHIPPED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST111333",
      shippedAt: new Date(now.getTime() - 15 * day),
      buyerStreet: me.street!, buyerHouseNumber: me.houseNumber,
      buyerPostalCode: me.postalCode!, buyerCity: me.city!, buyerCountry: me.country,
    },
  });
  for (const item of [
    { cardName: "1st Edition Machamp #8 Base Set", condition: "Moderately Played", price: 35.00 },
    { cardName: "Shadowless Alakazam #1", condition: "Lightly Played", price: 45.00 },
    { cardName: "Dark Charizard #4 Rocket", condition: "Near Mint", price: 25.00 },
    { cardName: "Shining Gyarados Neo Revelation", condition: "Lightly Played", price: 15.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: { claimsaleId: cs6.id, cardName: item.cardName, condition: item.condition, price: item.price, imageUrls: "[]", status: "SOLD", buyerId: me.id, shippingBundleId: purchase4.id },
    });
  }
  console.log(`  ${purchase4.orderNumber} SHIPPED (dispute-eligible) — Claimsale 4 items €126.95 (${bots[3].displayName})`);

  // --- PURCHASE 5: COMPLETED — Auction ---
  const auction4 = await prisma.auction.create({
    data: {
      title: "Gold Star Rayquaza Delta Species",
      description: "Extremely rare gold star card", imageUrls: "[]",
      currentBid: 29.99, finalPrice: 29.99, condition: "Lightly Played",
      status: "ENDED_SOLD", auctionType: "SINGLE_CARD", startingBid: 10.00,
      sellerId: bots[4].id, winnerId: me.id,
      endTime: new Date(now.getTime() - 22 * day), duration: 7, paymentStatus: "PAID",
    },
  });
  const purchase5 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(new Date(now.getTime() - 20 * day)), buyerId: me.id, sellerId: bots[4].id,
      shippingCost: 4.95, totalItemCost: 29.99, totalCost: 34.94, status: "COMPLETED",
      auctionId: auction4.id,
      trackingUrl: "https://postnl.nl/tracktrace/3STEST444666",
      shippedAt: new Date(now.getTime() - 20 * day),
      deliveredAt: new Date(now.getTime() - 14 * day),
      buyerStreet: me.street!, buyerHouseNumber: me.houseNumber,
      buyerPostalCode: me.postalCode!, buyerCity: me.city!, buyerCountry: me.country,
    },
  });
  console.log(`  ${purchase5.orderNumber} COMPLETED — Auction €34.94 (${bots[4].displayName})`);

  // --- PURCHASE 6: COMPLETED — Listing ---
  const listing4 = await prisma.listing.create({
    data: {
      title: "Celebrations Elite Trainer Box",
      description: "Sealed ETB", imageUrls: "[]",
      price: 54.99, condition: "Mint", status: "SOLD",
      sellerId: bots[5].id, buyerId: me.id,
      listingType: "SEALED_PRODUCT", pricingType: "FIXED",
    },
  });
  const purchase6 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(new Date(now.getTime() - 25 * day)), buyerId: me.id, sellerId: bots[5].id,
      shippingCost: 6.95, totalItemCost: 54.99, totalCost: 61.94, status: "COMPLETED",
      listingId: listing4.id,
      trackingUrl: "https://postnl.nl/tracktrace/3STEST777888",
      shippedAt: new Date(now.getTime() - 25 * day),
      deliveredAt: new Date(now.getTime() - 19 * day),
      buyerStreet: me.street!, buyerHouseNumber: me.houseNumber,
      buyerPostalCode: me.postalCode!, buyerCity: me.city!, buyerCountry: me.country,
    },
  });
  console.log(`  ${purchase6.orderNumber} COMPLETED — Listing €61.94 (${bots[5].displayName})`);

  // --- PURCHASE 7: CANCELLED ---
  const purchase7 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(new Date(now.getTime() - 12 * day)), buyerId: me.id, sellerId: bots[0].id,
      shippingCost: 4.95, totalItemCost: 8.50, totalCost: 13.45, status: "CANCELLED",
      buyerStreet: me.street!, buyerHouseNumber: me.houseNumber,
      buyerPostalCode: me.postalCode!, buyerCity: me.city!, buyerCountry: me.country,
    },
  });
  console.log(`  ${purchase7.orderNumber} CANCELLED — €13.45 (${bots[0].displayName})`);

  console.log("\n✅ Done! 9 sales + 7 purchases aangemaakt.");
  console.log("   Inclusief: 4 SHIPPED sales (refund testen), 1 met al-gerefund item.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
