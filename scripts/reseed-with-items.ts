import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

function genOrder(date: Date): string {
  const d = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  return `ORD-${d}-${String(Math.floor(Math.random()*9000)+1000)}`;
}

async function main() {
  const atomicsnipz = await prisma.user.findFirst({ where: { email: "yourivankerkhoven@gmail.com" } });
  if (!atomicsnipz) { console.error("User not found"); return; }

  const bots = await prisma.user.findMany({
    where: { email: { not: "yourivankerkhoven@gmail.com" } },
    take: 6,
  });

  // Delete old test bundles
  const oldBundles = await prisma.shippingBundle.findMany({
    where: { OR: [{ buyerId: atomicsnipz.id }, { sellerId: atomicsnipz.id }] },
    select: { id: true },
  });
  for (const b of oldBundles) {
    await prisma.claimsaleItem.updateMany({ where: { shippingBundleId: b.id }, data: { shippingBundleId: null, buyerId: null, status: "AVAILABLE" } });
    await prisma.dispute.deleteMany({ where: { shippingBundleId: b.id } });
  }
  await prisma.shippingBundle.deleteMany({
    where: { OR: [{ buyerId: atomicsnipz.id }, { sellerId: atomicsnipz.id }] },
  });
  console.log(`Deleted ${oldBundles.length} old bundles`);

  const now = new Date();

  // ==========================================
  // SALE 1: Claimsale with 4 items — PAID
  // ==========================================
  console.log("\n💰 Sales (atomicsnipz = seller):");

  // Create a claimsale owned by atomicsnipz
  const cs1 = await prisma.claimsale.create({
    data: {
      title: "Pokémon Base Set NM Lot",
      description: "4 Near Mint Base Set kaarten",
      status: "LIVE",
      sellerId: atomicsnipz.id,
      shippingCost: 4.95,
      coverImage: "/api/uploads/placeholder.jpg",
    },
  });

  const sale1 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now),
      buyerId: bots[0].id,
      sellerId: atomicsnipz.id,
      shippingCost: 4.95,
      totalItemCost: 47.50,
      totalCost: 52.45,
      status: "PAID",
      buyerStreet: "Herengracht", buyerHouseNumber: "42",
      buyerPostalCode: "1015BN", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });

  const items1 = [
    { cardName: "Charizard Base Set #4", condition: "Near Mint", price: 18.50 },
    { cardName: "Blastoise Base Set #2", condition: "Near Mint", price: 12.00 },
    { cardName: "Venusaur Base Set #15", condition: "Lightly Played", price: 9.50 },
    { cardName: "Pikachu Base Set #58", condition: "Near Mint", price: 7.50 },
  ];
  for (const item of items1) {
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: cs1.id,
        cardName: item.cardName,
        condition: item.condition,
        price: item.price,
        imageUrls: "[]",
        status: "SOLD",
        buyerId: bots[0].id,
        shippingBundleId: sale1.id,
      },
    });
  }
  console.log(`  ${sale1.orderNumber} PAID — Claimsale 4 items (buyer: ${bots[0].displayName})`);

  // ==========================================
  // SALE 2: Claimsale with 2 items — SHIPPED
  // ==========================================
  const cs2 = await prisma.claimsale.create({
    data: {
      title: "Japanese Promos",
      description: "2 Japanese promo kaarten",
      status: "LIVE",
      sellerId: atomicsnipz.id,
      shippingCost: 6.50,
      coverImage: "/api/uploads/placeholder.jpg",
    },
  });

  const sale2 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now),
      buyerId: bots[1].id,
      sellerId: atomicsnipz.id,
      shippingCost: 6.50,
      totalItemCost: 35.00,
      totalCost: 41.50,
      status: "SHIPPED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST654321",
      shippedAt: new Date(now.getTime() - 2 * 86400000),
      buyerStreet: "Prinsengracht", buyerHouseNumber: "263",
      buyerPostalCode: "1016GV", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });

  for (const item of [
    { cardName: "Mew ex (JP Promo #151)", condition: "Mint", price: 22.00 },
    { cardName: "Mewtwo V (JP Promo)", condition: "Near Mint", price: 13.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: cs2.id,
        cardName: item.cardName,
        condition: item.condition,
        price: item.price,
        imageUrls: "[]",
        status: "SOLD",
        buyerId: bots[1].id,
        shippingBundleId: sale2.id,
      },
    });
  }
  console.log(`  ${sale2.orderNumber} SHIPPED — Claimsale 2 items (buyer: ${bots[1].displayName})`);

  // ==========================================
  // SALE 3: Completed order
  // ==========================================
  const sale3 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now),
      buyerId: bots[2].id,
      sellerId: atomicsnipz.id,
      shippingCost: 4.95,
      totalItemCost: 89.99,
      totalCost: 94.94,
      status: "COMPLETED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST789012",
      shippedAt: new Date(now.getTime() - 12 * 86400000),
      deliveredAt: new Date(now.getTime() - 7 * 86400000),
      buyerStreet: "Damstraat", buyerHouseNumber: "7",
      buyerPostalCode: "1012JL", buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });

  // Create a listing linked to this sale
  const listing1 = await prisma.listing.create({
    data: {
      title: "Umbreon VMAX Alt Art #215",
      description: "Beautiful alt art card in near mint condition",
      imageUrls: "[]",
      price: 89.99,
      condition: "Near Mint",
      status: "SOLD",
      sellerId: atomicsnipz.id,
      buyerId: bots[2].id,
      listingType: "SINGLE_CARD",
      pricingType: "FIXED",
    },
  });
  await prisma.shippingBundle.update({ where: { id: sale3.id }, data: { listingId: listing1.id } });
  console.log(`  ${sale3.orderNumber} COMPLETED — Listing (buyer: ${bots[2].displayName})`);

  // ==========================================
  // PURCHASES (atomicsnipz = buyer)
  // ==========================================
  console.log("\n📦 Purchases (atomicsnipz = buyer):");

  // Purchase 1: Claimsale with 3 items — PAID
  const cs3 = await prisma.claimsale.create({
    data: {
      title: "Scarlet & Violet Hits",
      description: "3 SV hits",
      status: "LIVE",
      sellerId: bots[0].id,
      shippingCost: 4.95,
      coverImage: "/api/uploads/placeholder.jpg",
    },
  });

  const purchase1 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now),
      buyerId: atomicsnipz.id,
      sellerId: bots[0].id,
      shippingCost: 4.95,
      totalItemCost: 42.50,
      totalCost: 47.45,
      status: "PAID",
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });

  for (const item of [
    { cardName: "Charizard ex SV #199", condition: "Mint", price: 18.00 },
    { cardName: "Miraidon ex SV #081", condition: "Near Mint", price: 14.50 },
    { cardName: "Koraidon ex SV #124", condition: "Near Mint", price: 10.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: cs3.id,
        cardName: item.cardName,
        condition: item.condition,
        price: item.price,
        imageUrls: "[]",
        status: "SOLD",
        buyerId: atomicsnipz.id,
        shippingBundleId: purchase1.id,
      },
    });
  }
  console.log(`  ${purchase1.orderNumber} PAID — Claimsale 3 items (seller: ${bots[0].displayName})`);

  // Purchase 2: Old PAID (cancellable)
  const purchase2 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(new Date(now.getTime() - 8 * 86400000)),
      buyerId: atomicsnipz.id,
      sellerId: bots[1].id,
      shippingCost: 3.50,
      totalItemCost: 12.99,
      totalCost: 16.49,
      status: "PAID",
      createdAt: new Date(now.getTime() - 8 * 86400000),
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });

  // Auction-linked purchase
  const auction1 = await prisma.auction.create({
    data: {
      title: "Pikachu VMAX Rainbow Rare",
      description: "Beautiful rainbow rare",
      imageUrls: "[]",
      currentBid: 12.99,
      finalPrice: 12.99,
      condition: "Near Mint",
      status: "ENDED_SOLD",
      auctionType: "SINGLE_CARD",
      startingBid: 5.00,
      sellerId: bots[1].id,
      winnerId: atomicsnipz.id,
      endTime: new Date(now.getTime() - 8 * 86400000),
      duration: 7,
      paymentStatus: "PAID",
    },
  });
  await prisma.shippingBundle.update({ where: { id: purchase2.id }, data: { auctionId: auction1.id } });
  console.log(`  ${purchase2.orderNumber} PAID (cancellable) — Auction (seller: ${bots[1].displayName})`);

  // Purchase 3: SHIPPED with tracking
  const purchase3 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now),
      buyerId: atomicsnipz.id,
      sellerId: bots[2].id,
      shippingCost: 4.95,
      totalItemCost: 67.50,
      totalCost: 72.45,
      status: "SHIPPED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST555777",
      shippedAt: new Date(now.getTime() - 5 * 86400000),
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });

  // Listing-linked purchase
  const listing2 = await prisma.listing.create({
    data: {
      title: "Eevee Heroes Booster Box (JP)",
      description: "Sealed Japanese booster box",
      imageUrls: "[]",
      price: 67.50,
      condition: "Mint",
      status: "SOLD",
      sellerId: bots[2].id,
      buyerId: atomicsnipz.id,
      listingType: "SEALED_PRODUCT",
      pricingType: "FIXED",
    },
  });
  await prisma.shippingBundle.update({ where: { id: purchase3.id }, data: { listingId: listing2.id } });
  console.log(`  ${purchase3.orderNumber} SHIPPED — Listing (seller: ${bots[2].displayName})`);

  // Purchase 4: SHIPPED dispute-eligible (>10 days)
  const cs4 = await prisma.claimsale.create({
    data: {
      title: "Vintage Bulk Lot",
      description: "Mixed vintage lot",
      status: "LIVE",
      sellerId: bots[3].id,
      shippingCost: 6.95,
      coverImage: "/api/uploads/placeholder.jpg",
    },
  });

  const purchase4 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now),
      buyerId: atomicsnipz.id,
      sellerId: bots[3].id,
      shippingCost: 6.95,
      totalItemCost: 120.00,
      totalCost: 126.95,
      status: "SHIPPED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST111333",
      shippedAt: new Date(now.getTime() - 15 * 86400000),
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });

  for (const item of [
    { cardName: "1st Edition Machamp #8 Base Set", condition: "Moderately Played", price: 35.00 },
    { cardName: "Shadowless Alakazam #1", condition: "Lightly Played", price: 45.00 },
    { cardName: "Dark Charizard #4 Rocket", condition: "Near Mint", price: 25.00 },
    { cardName: "Shining Gyarados Neo Revelation", condition: "Lightly Played", price: 15.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: cs4.id,
        cardName: item.cardName,
        condition: item.condition,
        price: item.price,
        imageUrls: "[]",
        status: "SOLD",
        buyerId: atomicsnipz.id,
        shippingBundleId: purchase4.id,
      },
    });
  }
  console.log(`  ${purchase4.orderNumber} SHIPPED (dispute-eligible) — Claimsale 4 items (seller: ${bots[3].displayName})`);

  // Purchase 5: COMPLETED
  const purchase5 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now),
      buyerId: atomicsnipz.id,
      sellerId: bots[4].id,
      shippingCost: 4.95,
      totalItemCost: 29.99,
      totalCost: 34.94,
      status: "COMPLETED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST444666",
      shippedAt: new Date(now.getTime() - 20 * 86400000),
      deliveredAt: new Date(now.getTime() - 14 * 86400000),
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });

  const auction2 = await prisma.auction.create({
    data: {
      title: "Gold Star Rayquaza Delta Species",
      description: "Extremely rare gold star card",
      imageUrls: "[]",
      currentBid: 29.99,
      finalPrice: 29.99,
      condition: "Lightly Played",
      status: "ENDED_SOLD",
      auctionType: "SINGLE_CARD",
      startingBid: 10.00,
      sellerId: bots[4].id,
      winnerId: atomicsnipz.id,
      endTime: new Date(now.getTime() - 20 * 86400000),
      duration: 7,
      paymentStatus: "PAID",
    },
  });
  await prisma.shippingBundle.update({ where: { id: purchase5.id }, data: { auctionId: auction2.id } });
  console.log(`  ${purchase5.orderNumber} COMPLETED — Auction (seller: ${bots[4].displayName})`);

  // Purchase 6: CANCELLED
  const purchase6 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now),
      buyerId: atomicsnipz.id,
      sellerId: bots[5].id,
      shippingCost: 4.95,
      totalItemCost: 8.50,
      totalCost: 13.45,
      status: "CANCELLED",
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ${purchase6.orderNumber} CANCELLED (seller: ${bots[5].displayName})`);

  console.log("\n✅ Done! All orders have items, order numbers, and mixed source types.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
