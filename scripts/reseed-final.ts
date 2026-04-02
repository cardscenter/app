import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

function genOrder(date: Date): string {
  const d = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  return `ORD-${d}-${String(Math.floor(Math.random()*9000)+1000)}`;
}

async function main() {
  console.log("🧹 Cleaning up old test data...\n");

  const atomicsnipz = await prisma.user.findFirst({ where: { email: "yourivankerkhoven@gmail.com" } });
  if (!atomicsnipz) { console.error("User not found"); return; }

  const bots = await prisma.user.findMany({
    where: { email: { not: "yourivankerkhoven@gmail.com" } },
    take: 6,
  });

  // Clean up old bundles
  const oldBundles = await prisma.shippingBundle.findMany({
    where: { OR: [{ buyerId: atomicsnipz.id }, { sellerId: atomicsnipz.id }] },
    select: { id: true, auctionId: true, listingId: true },
  });
  for (const b of oldBundles) {
    await prisma.claimsaleItem.updateMany({ where: { shippingBundleId: b.id }, data: { shippingBundleId: null, buyerId: null, status: "AVAILABLE" } });
    await prisma.dispute.deleteMany({ where: { shippingBundleId: b.id } });
  }
  await prisma.shippingBundle.deleteMany({ where: { OR: [{ buyerId: atomicsnipz.id }, { sellerId: atomicsnipz.id }] } });

  // Clean up test auctions/listings created by seed
  await prisma.auction.deleteMany({ where: { title: { in: ["Pikachu VMAX Rainbow Rare", "Gold Star Rayquaza Delta Species"] } } });
  await prisma.listing.deleteMany({ where: { title: { in: ["Umbreon VMAX Alt Art #215", "Eevee Heroes Booster Box (JP)"] } } });

  // Clean up test claimsales
  await prisma.claimsaleItem.deleteMany({ where: { claimsale: { title: { in: [
    "Pokémon Base Set NM Lot", "Japanese Promos", "Scarlet & Violet Hits", "Vintage Bulk Lot",
  ] } } } });
  await prisma.claimsale.deleteMany({ where: { title: { in: [
    "Pokémon Base Set NM Lot", "Japanese Promos", "Scarlet & Violet Hits", "Vintage Bulk Lot",
  ] } } });

  console.log("✓ Cleaned up\n");

  // Ensure addresses & names
  await prisma.user.update({
    where: { id: atomicsnipz.id },
    data: {
      street: atomicsnipz.street || "Kalverstraat", houseNumber: atomicsnipz.houseNumber || "1",
      postalCode: atomicsnipz.postalCode || "1012NX", city: atomicsnipz.city || "Amsterdam",
      country: atomicsnipz.country || "NL", firstName: atomicsnipz.firstName || "Youri",
      lastName: atomicsnipz.lastName || "van Kerkhoven",
    },
  });
  for (const bot of bots) {
    await prisma.user.update({
      where: { id: bot.id },
      data: {
        street: bot.street || "Herengracht",
        houseNumber: bot.houseNumber || String(Math.floor(Math.random() * 200) + 1),
        postalCode: bot.postalCode || "1015BN", city: bot.city || "Amsterdam",
        country: bot.country || "NL",
        firstName: bot.firstName || bot.displayName.split(/[_-]/)[0],
        lastName: bot.lastName || "Testuser",
      },
    });
  }

  const now = new Date();

  // ============================================================
  // SALES (atomicsnipz = SELLER)
  // ============================================================
  console.log("💰 SALES (atomicsnipz = seller):\n");

  // --- SALE 1: Claimsale PAID — 4 items with references ---
  const cs1 = await prisma.claimsale.create({
    data: {
      title: "Base Set Near Mint Collectie", description: "Mooie Base Set kaarten in NM conditie",
      status: "LIVE", sellerId: atomicsnipz.id, shippingCost: 4.95, coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const sale1 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[0].id, sellerId: atomicsnipz.id,
      shippingCost: 4.95, totalItemCost: 47.50, totalCost: 52.45, status: "PAID",
      buyerStreet: "Herengracht", buyerHouseNumber: "42", buyerPostalCode: "1015BN",
      buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  for (const item of [
    { cardName: "Charizard", cardNum: "4/102", note: "Map A, pagina 2", cond: "Near Mint", price: 18.50 },
    { cardName: "Blastoise", cardNum: "2/102", note: "Map A, pagina 3", cond: "Near Mint", price: 12.00 },
    { cardName: "Venusaur", cardNum: "15/102", note: "Map A, pagina 5", cond: "Lightly Played", price: 9.50 },
    { cardName: "Pikachu", cardNum: "58/102", note: "Map B, pagina 1", cond: "Near Mint", price: 7.50 },
  ]) {
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: cs1.id, cardName: item.cardName, condition: item.cond, price: item.price,
        reference: item.cardNum, sellerNote: item.note, imageUrls: "[]",
        status: "SOLD", buyerId: bots[0].id, shippingBundleId: sale1.id,
      },
    });
  }
  console.log(`  ✓ ${sale1.orderNumber} PAID — Claimsale 4 items (${bots[0].displayName})`);

  // --- SALE 2: Claimsale PAID — 2 items ---
  const cs2 = await prisma.claimsale.create({
    data: {
      title: "Japanese Promo Lot", description: "Zeldzame Japanse promos",
      status: "LIVE", sellerId: atomicsnipz.id, shippingCost: 6.50, coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const sale2 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[1].id, sellerId: atomicsnipz.id,
      shippingCost: 6.50, totalItemCost: 35.00, totalCost: 41.50, status: "PAID",
      buyerStreet: "Prinsengracht", buyerHouseNumber: "263", buyerPostalCode: "1016GV",
      buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  for (const item of [
    { cardName: "Mew ex", cardNum: "151/165", note: "Vitrine schap 2", cond: "Mint", price: 22.00 },
    { cardName: "Mewtwo V", cardNum: "072/078", note: "Vitrine schap 2", cond: "Near Mint", price: 13.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: cs2.id, cardName: item.cardName, condition: item.cond, price: item.price,
        reference: item.cardNum, sellerNote: item.note, imageUrls: "[]",
        status: "SOLD", buyerId: bots[1].id, shippingBundleId: sale2.id,
      },
    });
  }
  console.log(`  ✓ ${sale2.orderNumber} PAID — Claimsale 2 items (${bots[1].displayName})`);

  // --- SALE 3: Claimsale SHIPPED — 3 items ---
  const cs3 = await prisma.claimsale.create({
    data: {
      title: "Scarlet & Violet Hits", description: "SV ultra rares",
      status: "LIVE", sellerId: atomicsnipz.id, shippingCost: 4.95, coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const sale3 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[2].id, sellerId: atomicsnipz.id,
      shippingCost: 4.95, totalItemCost: 42.50, totalCost: 47.45, status: "SHIPPED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST654321",
      shippedAt: new Date(now.getTime() - 2 * 86400000),
      buyerStreet: "Damstraat", buyerHouseNumber: "7", buyerPostalCode: "1012JL",
      buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  for (const item of [
    { cardName: "Charizard ex", cardNum: "SV3-199", note: "Map C, pagina 1", cond: "Near Mint", price: 18.00 },
    { cardName: "Miraidon ex", cardNum: "SV1-081", note: "Map C, pagina 3", cond: "Near Mint", price: 14.50 },
    { cardName: "Koraidon ex", cardNum: "SV1-124", note: "Map C, pagina 4", cond: "Mint", price: 10.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: cs3.id, cardName: item.cardName, condition: item.cond, price: item.price,
        reference: item.cardNum, sellerNote: item.note, imageUrls: "[]",
        status: "SOLD", buyerId: bots[2].id, shippingBundleId: sale3.id,
      },
    });
  }
  console.log(`  ✓ ${sale3.orderNumber} SHIPPED — Claimsale 3 items (${bots[2].displayName})`);

  // --- SALE 4: Listing COMPLETED ---
  const listing1 = await prisma.listing.create({
    data: {
      title: "Umbreon VMAX Alt Art #215", description: "Beautiful alt art",
      imageUrls: "[]", price: 89.99, condition: "Near Mint", status: "SOLD",
      sellerId: atomicsnipz.id, buyerId: bots[3].id, listingType: "SINGLE_CARD", pricingType: "FIXED",
    },
  });
  const sale4 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[3].id, sellerId: atomicsnipz.id,
      shippingCost: 4.95, totalItemCost: 89.99, totalCost: 94.94, status: "COMPLETED",
      listingId: listing1.id, trackingUrl: "https://postnl.nl/tracktrace/3STEST789012",
      shippedAt: new Date(now.getTime() - 12 * 86400000),
      deliveredAt: new Date(now.getTime() - 7 * 86400000),
      buyerStreet: "Rokin", buyerHouseNumber: "15", buyerPostalCode: "1012KK",
      buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  console.log(`  ✓ ${sale4.orderNumber} COMPLETED — Listing (${bots[3].displayName})`);

  // --- SALE 5: Auction COMPLETED ---
  const auction1 = await prisma.auction.create({
    data: {
      title: "Pikachu Gold Star EX Deoxys", description: "Iconic gold star",
      imageUrls: "[]", currentBid: 155.00, finalPrice: 155.00, condition: "Lightly Played",
      status: "ENDED_SOLD", auctionType: "SINGLE_CARD", startingBid: 50.00,
      sellerId: atomicsnipz.id, winnerId: bots[4].id,
      endTime: new Date(now.getTime() - 5 * 86400000), duration: 7, paymentStatus: "PAID",
    },
  });
  const sale5 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: bots[4].id, sellerId: atomicsnipz.id,
      shippingCost: 6.95, totalItemCost: 155.00, totalCost: 161.95, status: "SHIPPED",
      auctionId: auction1.id, trackingUrl: "https://postnl.nl/tracktrace/3STEST111222",
      shippedAt: new Date(now.getTime() - 3 * 86400000),
      buyerStreet: "Vondelstraat", buyerHouseNumber: "88", buyerPostalCode: "1054GN",
      buyerCity: "Amsterdam", buyerCountry: "NL",
    },
  });
  console.log(`  ✓ ${sale5.orderNumber} SHIPPED — Auction (${bots[4].displayName})`);

  // ============================================================
  // PURCHASES (atomicsnipz = BUYER)
  // ============================================================
  console.log("\n📦 PURCHASES (atomicsnipz = buyer):\n");

  // --- PURCHASE 1: Claimsale PAID — 3 items ---
  const cs4 = await prisma.claimsale.create({
    data: {
      title: "Evolving Skies Hits", description: "Top pulls from ES",
      status: "LIVE", sellerId: bots[0].id, shippingCost: 4.95, coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const purchase1 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: atomicsnipz.id, sellerId: bots[0].id,
      shippingCost: 4.95, totalItemCost: 76.50, totalCost: 81.45, status: "PAID",
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });
  for (const item of [
    { cardName: "Rayquaza VMAX Alt Art", cardNum: "218/203", cond: "Mint", price: 35.00 },
    { cardName: "Umbreon VMAX Alt Art", cardNum: "215/203", cond: "Near Mint", price: 28.50 },
    { cardName: "Sylveon VMAX Alt Art", cardNum: "212/203", cond: "Near Mint", price: 13.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: cs4.id, cardName: item.cardName, condition: item.cond, price: item.price,
        reference: item.cardNum, sellerNote: "Lade 3", imageUrls: "[]",
        status: "SOLD", buyerId: atomicsnipz.id, shippingBundleId: purchase1.id,
      },
    });
  }
  console.log(`  ✓ ${purchase1.orderNumber} PAID — Claimsale 3 items (${bots[0].displayName})`);

  // --- PURCHASE 2: Auction PAID — cancellable (8 days old) ---
  const auction2 = await prisma.auction.create({
    data: {
      title: "Pikachu VMAX Rainbow Rare #188", description: "Rainbow rare",
      imageUrls: "[]", currentBid: 22.50, finalPrice: 22.50, condition: "Near Mint",
      status: "ENDED_SOLD", auctionType: "SINGLE_CARD", startingBid: 5.00,
      sellerId: bots[1].id, winnerId: atomicsnipz.id,
      endTime: new Date(now.getTime() - 8 * 86400000), duration: 7, paymentStatus: "PAID",
    },
  });
  const purchase2 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(new Date(now.getTime() - 8 * 86400000)),
      buyerId: atomicsnipz.id, sellerId: bots[1].id,
      shippingCost: 3.50, totalItemCost: 22.50, totalCost: 26.00, status: "PAID",
      auctionId: auction2.id,
      createdAt: new Date(now.getTime() - 8 * 86400000),
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ✓ ${purchase2.orderNumber} PAID (cancellable) — Auction (${bots[1].displayName})`);

  // --- PURCHASE 3: Listing SHIPPED — 5 days ---
  const listing2 = await prisma.listing.create({
    data: {
      title: "Eevee Heroes Booster Box (JP)", description: "Sealed Japanese booster box",
      imageUrls: "[]", price: 67.50, condition: "Mint", status: "SOLD",
      sellerId: bots[2].id, buyerId: atomicsnipz.id, listingType: "SEALED_PRODUCT", pricingType: "FIXED",
    },
  });
  const purchase3 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: atomicsnipz.id, sellerId: bots[2].id,
      shippingCost: 6.95, totalItemCost: 67.50, totalCost: 74.45, status: "SHIPPED",
      listingId: listing2.id, trackingUrl: "https://postnl.nl/tracktrace/3STEST555777",
      shippedAt: new Date(now.getTime() - 5 * 86400000),
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ✓ ${purchase3.orderNumber} SHIPPED — Listing (${bots[2].displayName})`);

  // --- PURCHASE 4: Claimsale SHIPPED — dispute eligible (15 days) ---
  const cs5 = await prisma.claimsale.create({
    data: {
      title: "Vintage WOTC Lot", description: "Mixed vintage lot",
      status: "LIVE", sellerId: bots[3].id, shippingCost: 6.95, coverImage: "/api/uploads/placeholder.jpg",
    },
  });
  const purchase4 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: atomicsnipz.id, sellerId: bots[3].id,
      shippingCost: 6.95, totalItemCost: 120.00, totalCost: 126.95, status: "SHIPPED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST111333",
      shippedAt: new Date(now.getTime() - 15 * 86400000),
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });
  for (const item of [
    { cardName: "1st Ed. Machamp", cardNum: "8/102", cond: "Moderately Played", price: 35.00 },
    { cardName: "Shadowless Alakazam", cardNum: "1/102", cond: "Lightly Played", price: 45.00 },
    { cardName: "Dark Charizard", cardNum: "4/82", cond: "Near Mint", price: 25.00 },
    { cardName: "Shining Gyarados", cardNum: "65/64", cond: "Lightly Played", price: 15.00 },
  ]) {
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: cs5.id, cardName: item.cardName, condition: item.cond, price: item.price,
        reference: item.cardNum, sellerNote: "Binder 1", imageUrls: "[]",
        status: "SOLD", buyerId: atomicsnipz.id, shippingBundleId: purchase4.id,
      },
    });
  }
  console.log(`  ✓ ${purchase4.orderNumber} SHIPPED (dispute-eligible) — Claimsale 4 items (${bots[3].displayName})`);

  // --- PURCHASE 5: Auction COMPLETED ---
  const auction3 = await prisma.auction.create({
    data: {
      title: "Gold Star Rayquaza Delta Species", description: "Extremely rare gold star",
      imageUrls: "[]", currentBid: 45.00, finalPrice: 45.00, condition: "Lightly Played",
      status: "ENDED_SOLD", auctionType: "SINGLE_CARD", startingBid: 10.00,
      sellerId: bots[4].id, winnerId: atomicsnipz.id,
      endTime: new Date(now.getTime() - 20 * 86400000), duration: 7, paymentStatus: "PAID",
    },
  });
  const purchase5 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: atomicsnipz.id, sellerId: bots[4].id,
      shippingCost: 4.95, totalItemCost: 45.00, totalCost: 49.95, status: "COMPLETED",
      auctionId: auction3.id, trackingUrl: "https://postnl.nl/tracktrace/3STEST444666",
      shippedAt: new Date(now.getTime() - 20 * 86400000),
      deliveredAt: new Date(now.getTime() - 14 * 86400000),
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ✓ ${purchase5.orderNumber} COMPLETED — Auction (${bots[4].displayName})`);

  // --- PURCHASE 6: Claimsale CANCELLED ---
  const purchase6 = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrder(now), buyerId: atomicsnipz.id, sellerId: bots[5].id,
      shippingCost: 4.95, totalItemCost: 8.50, totalCost: 13.45, status: "CANCELLED",
      buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ✓ ${purchase6.orderNumber} CANCELLED (${bots[5].displayName})`);

  // ============================================================
  // NOTIFICATIONS
  // ============================================================
  console.log("\n🔔 Notifications:\n");
  await prisma.notification.createMany({
    data: [
      { userId: atomicsnipz.id, type: "ORDER_PAID", title: "Nieuwe bestelling!", body: `${bots[0].displayName} heeft 4 items besteld uit je Base Set collectie.`, link: "/dashboard/verkopen" },
      { userId: atomicsnipz.id, type: "ORDER_PAID", title: "Nieuwe bestelling!", body: `${bots[1].displayName} heeft 2 Japanse promos besteld.`, link: "/dashboard/verkopen" },
      { userId: atomicsnipz.id, type: "ORDER_SHIPPED", title: "Bestelling verzonden!", body: `${bots[2].displayName} heeft je Eevee Heroes box verzonden.`, link: "/dashboard/aankopen" },
    ],
  });
  console.log("  ✓ 3 notifications created\n");

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("✅ Testdata compleet!\n");
  console.log("📋 VERKOPEN (5 orders):");
  console.log("   2x Claimsale PAID  (4 + 2 items, met referenties)");
  console.log("   1x Claimsale SHIPPED (3 items)");
  console.log("   1x Listing COMPLETED");
  console.log("   1x Auction SHIPPED");
  console.log("\n📋 AANKOPEN (6 orders):");
  console.log("   1x Claimsale PAID (3 items)");
  console.log("   1x Auction PAID (annuleerbaar, 8 dagen oud)");
  console.log("   1x Listing SHIPPED (5 dagen)");
  console.log("   1x Claimsale SHIPPED (4 items, geschil mogelijk, 15 dagen)");
  console.log("   1x Auction COMPLETED");
  console.log("   1x Claimsale CANCELLED");
}

main().catch(console.error).finally(() => prisma.$disconnect());
