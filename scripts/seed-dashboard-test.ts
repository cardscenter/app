import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧪 Creating dashboard test data for atomicsnipz...\n");

  const atomicsnipz = await prisma.user.findFirst({
    where: { email: "yourivankerkhoven@gmail.com" },
  });

  if (!atomicsnipz) {
    console.error("❌ User atomicsnipz not found!");
    return;
  }
  console.log(`✓ Found atomicsnipz: ${atomicsnipz.id}`);

  const bots = await prisma.user.findMany({
    where: { email: { not: "yourivankerkhoven@gmail.com" } },
    take: 6,
  });

  if (bots.length < 4) {
    console.error("❌ Need at least 4 bot users.");
    return;
  }
  console.log(`✓ Found ${bots.length} bot users\n`);

  // Ensure atomicsnipz has address
  await prisma.user.update({
    where: { id: atomicsnipz.id },
    data: {
      street: atomicsnipz.street || "Kalverstraat",
      houseNumber: atomicsnipz.houseNumber || "1",
      postalCode: atomicsnipz.postalCode || "1012NX",
      city: atomicsnipz.city || "Amsterdam",
      country: atomicsnipz.country || "NL",
      firstName: atomicsnipz.firstName || "Youri",
      lastName: atomicsnipz.lastName || "van Kerkhoven",
    },
  });

  // Ensure bots have addresses and names
  for (const bot of bots) {
    await prisma.user.update({
      where: { id: bot.id },
      data: {
        street: bot.street || "Herengracht",
        houseNumber: bot.houseNumber || String(Math.floor(Math.random() * 200) + 1),
        postalCode: bot.postalCode || "1015BN",
        city: bot.city || "Amsterdam",
        country: bot.country || "NL",
        firstName: bot.firstName || bot.displayName.split(/[_-]/)[0],
        lastName: bot.lastName || "Testuser",
      },
    });
  }

  // ============================================================
  // 1. SALES: atomicsnipz is SELLER — different statuses
  // ============================================================
  console.log("💰 Creating SALES (atomicsnipz = seller)...");

  // Sale 1: PAID — buyer paid, atomicsnipz needs to ship
  const sale1 = await prisma.shippingBundle.create({
    data: {
      buyerId: bots[0].id,
      sellerId: atomicsnipz.id,
      shippingCost: 4.95,
      totalItemCost: 25.00,
      totalCost: 29.95,
      status: "PAID",
      buyerStreet: "Herengracht",
      buyerHouseNumber: "42",
      buyerPostalCode: "1015BN",
      buyerCity: "Amsterdam",
      buyerCountry: "NL",
    },
  });
  console.log(`  ✓ Sale PAID: ${sale1.id} (buyer: ${bots[0].displayName})`);

  // Sale 2: PAID — another order to ship
  const sale2 = await prisma.shippingBundle.create({
    data: {
      buyerId: bots[1].id,
      sellerId: atomicsnipz.id,
      shippingCost: 6.50,
      totalItemCost: 89.99,
      totalCost: 96.49,
      status: "PAID",
      buyerStreet: "Prinsengracht",
      buyerHouseNumber: "263",
      buyerPostalCode: "1016GV",
      buyerCity: "Amsterdam",
      buyerCountry: "NL",
    },
  });
  console.log(`  ✓ Sale PAID: ${sale2.id} (buyer: ${bots[1].displayName})`);

  // Sale 3: SHIPPED — already shipped with tracking
  const sale3 = await prisma.shippingBundle.create({
    data: {
      buyerId: bots[2].id,
      sellerId: atomicsnipz.id,
      shippingCost: 4.95,
      totalItemCost: 15.50,
      totalCost: 20.45,
      status: "SHIPPED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST123456789",
      shippedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      buyerStreet: "Damstraat",
      buyerHouseNumber: "7",
      buyerPostalCode: "1012JL",
      buyerCity: "Amsterdam",
      buyerCountry: "NL",
    },
  });
  console.log(`  ✓ Sale SHIPPED: ${sale3.id} (buyer: ${bots[2].displayName})`);

  // Sale 4: COMPLETED — delivered and confirmed
  const sale4 = await prisma.shippingBundle.create({
    data: {
      buyerId: bots[3].id,
      sellerId: atomicsnipz.id,
      shippingCost: 4.95,
      totalItemCost: 45.00,
      totalCost: 49.95,
      status: "COMPLETED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST987654321",
      shippedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      buyerStreet: "Rokin",
      buyerHouseNumber: "15",
      buyerPostalCode: "1012KK",
      buyerCity: "Amsterdam",
      buyerCountry: "NL",
    },
  });
  console.log(`  ✓ Sale COMPLETED: ${sale4.id} (buyer: ${bots[3].displayName})`);

  // ============================================================
  // 2. PURCHASES: atomicsnipz is BUYER — different statuses
  // ============================================================
  console.log("\n📦 Creating PURCHASES (atomicsnipz = buyer)...");

  // Purchase 1: PAID — waiting for seller to ship
  const purchase1 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[0].id,
      shippingCost: 4.95,
      totalItemCost: 35.00,
      totalCost: 39.95,
      status: "PAID",
      buyerStreet: atomicsnipz.street!,
      buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!,
      buyerCity: atomicsnipz.city!,
      buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ✓ Purchase PAID: ${purchase1.id} (seller: ${bots[0].displayName})`);

  // Purchase 2: PAID — older (can cancel after 7 days)
  const purchase2 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[1].id,
      shippingCost: 3.50,
      totalItemCost: 12.99,
      totalCost: 16.49,
      status: "PAID",
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago — can cancel
      buyerStreet: atomicsnipz.street!,
      buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!,
      buyerCity: atomicsnipz.city!,
      buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ✓ Purchase PAID (cancellable): ${purchase2.id} (seller: ${bots[1].displayName})`);

  // Purchase 3: SHIPPED — with tracking, can confirm delivery
  const purchase3 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[2].id,
      shippingCost: 4.95,
      totalItemCost: 67.50,
      totalCost: 72.45,
      status: "SHIPPED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST555666777",
      shippedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      buyerStreet: atomicsnipz.street!,
      buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!,
      buyerCity: atomicsnipz.city!,
      buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ✓ Purchase SHIPPED: ${purchase3.id} (seller: ${bots[2].displayName})`);

  // Purchase 4: SHIPPED — long ago, can open dispute (>10 days)
  const purchase4 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[3].id,
      shippingCost: 6.95,
      totalItemCost: 120.00,
      totalCost: 126.95,
      status: "SHIPPED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST111222333",
      shippedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago — can dispute
      buyerStreet: atomicsnipz.street!,
      buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!,
      buyerCity: atomicsnipz.city!,
      buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ✓ Purchase SHIPPED (dispute-eligible): ${purchase4.id} (seller: ${bots[3].displayName})`);

  // Purchase 5: COMPLETED
  const purchase5 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[4].id,
      shippingCost: 4.95,
      totalItemCost: 29.99,
      totalCost: 34.94,
      status: "COMPLETED",
      trackingUrl: "https://postnl.nl/tracktrace/3STEST444555666",
      shippedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      buyerStreet: atomicsnipz.street!,
      buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!,
      buyerCity: atomicsnipz.city!,
      buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ✓ Purchase COMPLETED: ${purchase5.id} (seller: ${bots[4].displayName})`);

  // Purchase 6: CANCELLED
  const purchase6 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[5].id,
      shippingCost: 4.95,
      totalItemCost: 8.50,
      totalCost: 13.45,
      status: "CANCELLED",
      buyerStreet: atomicsnipz.street!,
      buyerHouseNumber: atomicsnipz.houseNumber,
      buyerPostalCode: atomicsnipz.postalCode!,
      buyerCity: atomicsnipz.city!,
      buyerCountry: atomicsnipz.country,
    },
  });
  console.log(`  ✓ Purchase CANCELLED: ${purchase6.id} (seller: ${bots[5].displayName})`);

  // ============================================================
  // 3. NOTIFICATIONS for atomicsnipz
  // ============================================================
  console.log("\n🔔 Creating notifications...");

  await prisma.notification.createMany({
    data: [
      {
        userId: atomicsnipz.id,
        type: "ORDER_PAID",
        title: "Nieuwe bestelling ontvangen!",
        body: `${bots[0].displayName} heeft een bestelling geplaatst. Bekijk deze in je verkopen.`,
        link: "/dashboard/verkopen",
      },
      {
        userId: atomicsnipz.id,
        type: "ORDER_PAID",
        title: "Nieuwe bestelling ontvangen!",
        body: `${bots[1].displayName} heeft een bestelling geplaatst. Bekijk deze in je verkopen.`,
        link: "/dashboard/verkopen",
      },
      {
        userId: atomicsnipz.id,
        type: "ORDER_SHIPPED",
        title: "Je bestelling is verzonden!",
        body: `${bots[2].displayName} heeft je bestelling verzonden. Volg je pakket via de trackinglink.`,
        link: "/dashboard/aankopen",
      },
      {
        userId: atomicsnipz.id,
        type: "ORDER_COMPLETED",
        title: "Bezorging bevestigd!",
        body: "De koper heeft de ontvangst bevestigd. Het bedrag is vrijgegeven.",
        link: "/dashboard/verkopen",
        read: true,
      },
    ],
  });
  console.log("  ✓ 4 notifications created (2 ORDER_PAID, 1 ORDER_SHIPPED, 1 ORDER_COMPLETED)");

  // ============================================================
  // Summary
  // ============================================================
  console.log("\n✅ Dashboard test data created successfully!");
  console.log("\n📋 What to test:");
  console.log("  1. Dashboard → Profiel → Upload een profielfoto");
  console.log("  2. Dashboard → Verkopen → 2 PAID orders (met adresgegevens + verplichte tracking)");
  console.log("  3. Dashboard → Verkopen → 1 SHIPPED order (tracking link zichtbaar)");
  console.log("  4. Dashboard → Verkopen → 1 COMPLETED order");
  console.log("  5. Dashboard → Aankopen → 2 PAID orders (1 annuleerbaar na 7d)");
  console.log("  6. Dashboard → Aankopen → 2 SHIPPED orders (1 met geschil-optie na 10d)");
  console.log("  7. Dashboard → Aankopen → 1 COMPLETED, 1 CANCELLED order");
  console.log("  8. Dashboard → Meldingen → ORDER_PAID + ORDER_SHIPPED notificaties");
  console.log("  9. /verkoper/[userId] → Avatar, tier badge, verified badge");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
