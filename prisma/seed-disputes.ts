import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Setting up test data for atomicsnipz...\n");

  // Find atomicsnipz
  const atomicsnipz = await prisma.user.findFirst({
    where: { email: "yourivankerkhoven@gmail.com" },
  });

  if (!atomicsnipz) {
    console.error("❌ User atomicsnipz (yourivankerkhoven@gmail.com) not found!");
    return;
  }
  console.log(`✓ Found atomicsnipz: ${atomicsnipz.id}`);

  // Find some bot users to use as buyers/sellers
  const bots = await prisma.user.findMany({
    where: { email: { not: "yourivankerkhoven@gmail.com" } },
    take: 5,
  });

  if (bots.length < 3) {
    console.error("❌ Need at least 3 bot users. Run prisma/seed-testdata.ts first.");
    return;
  }
  console.log(`✓ Found ${bots.length} bot users\n`);

  // Make sure atomicsnipz has an address
  await prisma.user.update({
    where: { id: atomicsnipz.id },
    data: {
      street: atomicsnipz.street || "Kalverstraat",
      houseNumber: atomicsnipz.houseNumber || "1",
      postalCode: atomicsnipz.postalCode || "1012NX",
      city: atomicsnipz.city || "Amsterdam",
      country: atomicsnipz.country || "NL",
      balance: { increment: 500 },
    },
  });

  // Give bots addresses too
  const botAddresses = [
    { street: "Oudegracht", houseNumber: "42", postalCode: "3511AB", city: "Utrecht", country: "NL" },
    { street: "Meir", houseNumber: "15", postalCode: "2000", city: "Antwerpen", country: "BE" },
    { street: "Kurfürstendamm", houseNumber: "8", postalCode: "10719", city: "Berlin", country: "DE" },
    { street: "Coolsingel", houseNumber: "77", postalCode: "3012AA", city: "Rotterdam", country: "NL" },
    { street: "Grote Markt", houseNumber: "3", postalCode: "9711LV", city: "Groningen", country: "NL" },
  ];

  for (let i = 0; i < bots.length; i++) {
    await prisma.user.update({
      where: { id: bots[i].id },
      data: {
        ...botAddresses[i],
        balance: { increment: 300 },
      },
    });
  }

  // ============================================================
  // 1. PURCHASES (atomicsnipz is BUYER)
  // ============================================================
  console.log("📦 Creating purchases (atomicsnipz = buyer)...");

  // Purchase 1: COMPLETED - bought from bot[0]
  const purchase1 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[0].id,
      status: "COMPLETED",
      shippingCost: 4.95,
      totalItemCost: 47.50,
      totalCost: 52.45,
      trackingUrl: "https://postnl.nl/tracktrace/T123456789NL",
      shippedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      buyerStreet: "Kalverstraat",
      buyerHouseNumber: "1",
      buyerPostalCode: "1012NX",
      buyerCity: "Amsterdam",
      buyerCountry: "NL",
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("  ✓ Purchase 1: COMPLETED (from " + bots[0].displayName + ")");

  // Purchase 2: SHIPPED - bought from bot[1], waiting for delivery
  const purchase2 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[1].id,
      status: "SHIPPED",
      shippingCost: 6.50,
      totalItemCost: 125.00,
      totalCost: 131.50,
      trackingUrl: "https://dhl.nl/track/JJD0001234567",
      shippedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      buyerStreet: "Kalverstraat",
      buyerHouseNumber: "1",
      buyerPostalCode: "1012NX",
      buyerCity: "Amsterdam",
      buyerCountry: "NL",
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("  ✓ Purchase 2: SHIPPED (from " + bots[1].displayName + ")");

  // Purchase 3: PAID - bought from bot[2], waiting for shipment
  const purchase3 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[2].id,
      status: "PAID",
      shippingCost: 3.50,
      totalItemCost: 18.75,
      totalCost: 22.25,
      buyerStreet: "Kalverstraat",
      buyerHouseNumber: "1",
      buyerPostalCode: "1012NX",
      buyerCity: "Amsterdam",
      buyerCountry: "NL",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("  ✓ Purchase 3: PAID (from " + bots[2].displayName + ")");

  // Purchase 4: SHIPPED long ago - dispute eligible (12 days)
  const purchase4 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[3].id,
      status: "SHIPPED",
      shippingCost: 4.95,
      totalItemCost: 89.00,
      totalCost: 93.95,
      shippedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      buyerStreet: "Kalverstraat",
      buyerHouseNumber: "1",
      buyerPostalCode: "1012NX",
      buyerCity: "Amsterdam",
      buyerCountry: "NL",
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("  ✓ Purchase 4: SHIPPED 12 days ago, no tracking - dispute eligible (from " + bots[3].displayName + ")");

  // ============================================================
  // 2. SALES (atomicsnipz is SELLER)
  // ============================================================
  console.log("\n💰 Creating sales (atomicsnipz = seller)...");

  // Sale 1: COMPLETED
  const sale1 = await prisma.shippingBundle.create({
    data: {
      buyerId: bots[0].id,
      sellerId: atomicsnipz.id,
      status: "COMPLETED",
      shippingCost: 4.95,
      totalItemCost: 35.00,
      totalCost: 39.95,
      trackingUrl: "https://postnl.nl/tracktrace/T987654321NL",
      shippedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      buyerStreet: botAddresses[0].street,
      buyerHouseNumber: botAddresses[0].houseNumber,
      buyerPostalCode: botAddresses[0].postalCode,
      buyerCity: botAddresses[0].city,
      buyerCountry: botAddresses[0].country,
      createdAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("  ✓ Sale 1: COMPLETED (to " + bots[0].displayName + ")");

  // Sale 2: PAID - needs to ship
  const sale2 = await prisma.shippingBundle.create({
    data: {
      buyerId: bots[1].id,
      sellerId: atomicsnipz.id,
      status: "PAID",
      shippingCost: 6.50,
      totalItemCost: 67.50,
      totalCost: 74.00,
      buyerStreet: botAddresses[1].street,
      buyerHouseNumber: botAddresses[1].houseNumber,
      buyerPostalCode: botAddresses[1].postalCode,
      buyerCity: botAddresses[1].city,
      buyerCountry: botAddresses[1].country,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });
  // Add escrow for this sale
  await prisma.user.update({
    where: { id: atomicsnipz.id },
    data: { heldBalance: { increment: 67.50 } },
  });
  console.log("  ✓ Sale 2: PAID - needs shipping (to " + bots[1].displayName + ")");

  // Sale 3: SHIPPED - waiting for buyer confirmation
  const sale3 = await prisma.shippingBundle.create({
    data: {
      buyerId: bots[2].id,
      sellerId: atomicsnipz.id,
      status: "SHIPPED",
      shippingCost: 3.50,
      totalItemCost: 42.00,
      totalCost: 45.50,
      trackingUrl: "https://postnl.nl/tracktrace/T111222333NL",
      shippedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      buyerStreet: botAddresses[2].street,
      buyerHouseNumber: botAddresses[2].houseNumber,
      buyerPostalCode: botAddresses[2].postalCode,
      buyerCity: botAddresses[2].city,
      buyerCountry: botAddresses[2].country,
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.user.update({
    where: { id: atomicsnipz.id },
    data: { heldBalance: { increment: 42.00 } },
  });
  console.log("  ✓ Sale 3: SHIPPED (to " + bots[2].displayName + ")");

  // Sale 4: COMPLETED
  const sale4 = await prisma.shippingBundle.create({
    data: {
      buyerId: bots[4].id,
      sellerId: atomicsnipz.id,
      status: "COMPLETED",
      shippingCost: 4.95,
      totalItemCost: 155.00,
      totalCost: 159.95,
      trackingUrl: "https://dhl.nl/track/JJD0009876543",
      shippedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      buyerStreet: botAddresses[4].street,
      buyerHouseNumber: botAddresses[4].houseNumber,
      buyerPostalCode: botAddresses[4].postalCode,
      buyerCity: botAddresses[4].city,
      buyerCountry: botAddresses[4].country,
      createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("  ✓ Sale 4: COMPLETED (to " + bots[4].displayName + ")");

  // ============================================================
  // 3. DISPUTES
  // ============================================================
  console.log("\n⚠️  Creating disputes...");

  // Dispute 1: atomicsnipz = buyer, OPEN dispute (seller hasn't responded)
  const disputeBundle1 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[4].id,
      status: "DISPUTED",
      shippingCost: 4.95,
      totalItemCost: 65.00,
      totalCost: 69.95,
      shippedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      buyerStreet: "Kalverstraat",
      buyerHouseNumber: "1",
      buyerPostalCode: "1012NX",
      buyerCity: "Amsterdam",
      buyerCountry: "NL",
      createdAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000),
    },
  });
  const dispute1 = await prisma.dispute.create({
    data: {
      shippingBundleId: disputeBundle1.id,
      openedById: atomicsnipz.id,
      reason: "NOT_RECEIVED",
      description: "Het pakket is al meer dan twee weken geleden verzonden maar ik heb nog niks ontvangen. Er is geen tracking link beschikbaar dus ik kan de status niet controleren.",
      evidenceUrls: "[]",
      status: "OPEN",
      responseDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.disputeEvent.create({
    data: {
      disputeId: dispute1.id,
      actorId: atomicsnipz.id,
      type: "OPENED",
      detail: "NOT_RECEIVED",
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.user.update({
    where: { id: bots[4].id },
    data: { heldBalance: { increment: 65.00 } },
  });
  console.log("  ✓ Dispute 1: OPEN - atomicsnipz as buyer, NOT_RECEIVED (vs " + bots[4].displayName + ")");

  // Dispute 2: atomicsnipz = seller, SELLER_RESPONDED (atomicsnipz responded)
  const disputeBundle2 = await prisma.shippingBundle.create({
    data: {
      buyerId: bots[3].id,
      sellerId: atomicsnipz.id,
      status: "DISPUTED",
      shippingCost: 6.50,
      totalItemCost: 85.00,
      totalCost: 91.50,
      trackingUrl: "https://postnl.nl/tracktrace/T444555666NL",
      shippedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
      buyerStreet: botAddresses[3].street,
      buyerHouseNumber: botAddresses[3].houseNumber,
      buyerPostalCode: botAddresses[3].postalCode,
      buyerCity: botAddresses[3].city,
      buyerCountry: botAddresses[3].country,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    },
  });
  const dispute2 = await prisma.dispute.create({
    data: {
      shippingBundleId: disputeBundle2.id,
      openedById: bots[3].id,
      reason: "NOT_AS_DESCRIBED",
      description: "De kaarten zijn beschreven als Near Mint maar er zitten duidelijk krassen en whitening op de randen. Dit is eerder Moderately Played conditie.",
      evidenceUrls: "[]",
      status: "SELLER_RESPONDED",
      sellerResponse: "Ik heb de kaarten zorgvuldig geïnspecteerd voor verzending en ze waren in de beschreven conditie. De foto's op de listing tonen de exacte kaarten die zijn verzonden. Ik stel voor dat we tot een compromis komen.",
      sellerEvidenceUrls: "[]",
      sellerRespondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      responseDeadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      buyerReviewDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      partialRefundAmount: 30.00,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.disputeEvent.createMany({
    data: [
      {
        disputeId: dispute2.id,
        actorId: bots[3].id,
        type: "OPENED",
        detail: "NOT_AS_DESCRIBED",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        disputeId: dispute2.id,
        actorId: atomicsnipz.id,
        type: "SELLER_RESPONDED",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ],
  });
  await prisma.user.update({
    where: { id: atomicsnipz.id },
    data: { heldBalance: { increment: 85.00 } },
  });
  console.log("  ✓ Dispute 2: SELLER_RESPONDED - atomicsnipz as seller, NOT_AS_DESCRIBED (vs " + bots[3].displayName + ")");

  // Dispute 3: RESOLVED - atomicsnipz = buyer, resolved in buyer favor
  const disputeBundle3 = await prisma.shippingBundle.create({
    data: {
      buyerId: atomicsnipz.id,
      sellerId: bots[0].id,
      status: "CANCELLED",
      shippingCost: 4.95,
      totalItemCost: 45.00,
      totalCost: 49.95,
      shippedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      buyerStreet: "Kalverstraat",
      buyerHouseNumber: "1",
      buyerPostalCode: "1012NX",
      buyerCity: "Amsterdam",
      buyerCountry: "NL",
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    },
  });
  const dispute3 = await prisma.dispute.create({
    data: {
      shippingBundleId: disputeBundle3.id,
      openedById: atomicsnipz.id,
      reason: "NOT_RECEIVED",
      description: "Pakket nooit ontvangen, geen tracking beschikbaar gesteld door verkoper.",
      evidenceUrls: "[]",
      status: "RESOLVED_BUYER",
      resolution: "REFUND_FULL",
      resolvedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      responseDeadline: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.disputeEvent.createMany({
    data: [
      {
        disputeId: dispute3.id,
        actorId: atomicsnipz.id,
        type: "OPENED",
        detail: "NOT_RECEIVED",
        createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      },
      {
        disputeId: dispute3.id,
        actorId: atomicsnipz.id,
        type: "RESOLVED",
        detail: "REFUND_FULL",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    ],
  });
  console.log("  ✓ Dispute 3: RESOLVED_BUYER - atomicsnipz got full refund (vs " + bots[0].displayName + ")");

  console.log("\n✅ All test data created successfully!");
  console.log("\nSummary:");
  console.log("  📦 4 purchases (atomicsnipz as buyer): COMPLETED, SHIPPED, PAID, SHIPPED (dispute-eligible)");
  console.log("  💰 4 sales (atomicsnipz as seller): COMPLETED x2, PAID (needs shipping), SHIPPED");
  console.log("  ⚠️  3 disputes:");
  console.log("     - OPEN: atomicsnipz = buyer, NOT_RECEIVED, no tracking");
  console.log("     - SELLER_RESPONDED: atomicsnipz = seller, NOT_AS_DESCRIBED, partial refund proposed");
  console.log("     - RESOLVED_BUYER: atomicsnipz = buyer, full refund received");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
