import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🛒 Seeding test purchases for turrileo...\n");

  // Find turrileo
  const maybeBuyer = await prisma.user.findUnique({
    where: { email: "yourivankerkhoven@gmail.com" },
  });
  if (!maybeBuyer) {
    console.error("❌ User turrileo (youribeppo@gmail.com) not found!");
    process.exit(1);
  }
  const buyer = maybeBuyer;
  console.log(`✓ Found buyer: ${buyer.displayName} (${buyer.id})`);

  // Find some bot sellers
  const sellers = await prisma.user.findMany({
    where: {
      email: { in: ["pikafan@test.nl", "charizard@test.nl", "max@test.nl", "vintage@test.nl", "shiny@test.nl"] },
    },
    include: {
      sellerShippingMethods: { where: { isActive: true }, take: 1 },
    },
  });

  if (sellers.length === 0) {
    console.error("❌ No bot sellers found! Run seed-testdata first.");
    process.exit(1);
  }
  console.log(`✓ Found ${sellers.length} sellers\n`);

  // Get some card sets for realistic items
  const cardSets = await prisma.cardSet.findMany({ take: 10 });
  if (cardSets.length === 0) {
    console.error("❌ No card sets found!");
    process.exit(1);
  }

  // Helper to create a claimsale + items + bundle
  async function createPurchase(config: {
    seller: typeof sellers[0];
    status: string;
    daysAgo: number;
    cards: { name: string; condition: string; price: number }[];
    shippingCost: number;
  }) {
    const { seller, status, daysAgo, cards, shippingCost } = config;
    const purchaseDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    // Create a claimsale from the seller
    const claimsale = await prisma.claimsale.create({
      data: {
        title: `[Test] ${seller.displayName} — ${cards[0].name} e.a.`,
        description: "Test claimsale voor seed data",
        shippingCost,
        status: "LIVE",
        publishedAt: new Date(purchaseDate.getTime() - 2 * 24 * 60 * 60 * 1000),
        sellerId: seller.id,
      },
    });

    // Create a shipping bundle
    const totalItemCost = cards.reduce((sum, c) => sum + c.price, 0);
    const shippingMethodId = seller.sellerShippingMethods[0]?.id ?? null;

    // Determine dates based on status
    const shippedAt = status === "SHIPPED" ? new Date(purchaseDate.getTime() + 2 * 24 * 60 * 60 * 1000) :
                      status === "COMPLETED" ? new Date(purchaseDate.getTime() + 1 * 24 * 60 * 60 * 1000) : null;
    const deliveredAt = status === "COMPLETED" ? new Date(purchaseDate.getTime() + 5 * 24 * 60 * 60 * 1000) : null;
    const trackingUrl = (status === "SHIPPED" || status === "COMPLETED") ? "https://postnl.nl/tracktrace/T0000000000NL" : null;

    const bundle = await prisma.shippingBundle.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.id,
        shippingCost,
        totalItemCost,
        totalCost: totalItemCost + shippingCost,
        status,
        shippingMethodId,
        trackingUrl,
        shippedAt,
        deliveredAt,
        buyerStreet: buyer.street ?? "Teststraat",
        buyerHouseNumber: buyer.houseNumber ?? "42",
        buyerPostalCode: buyer.postalCode ?? "1234 AB",
        buyerCity: buyer.city ?? "Amsterdam",
        buyerCountry: buyer.country ?? "NL",
        createdAt: purchaseDate,
        updatedAt: purchaseDate,
      },
    });

    // Create claimsale items (SOLD, linked to buyer + bundle)
    for (const card of cards) {
      const cardSet = cardSets[Math.floor(Math.random() * cardSets.length)];
      await prisma.claimsaleItem.create({
        data: {
          claimsaleId: claimsale.id,
          cardName: card.name,
          cardSetId: cardSet.id,
          condition: card.condition,
          price: card.price,
          status: status === "CANCELLED" ? "AVAILABLE" : "SOLD",
          buyerId: status === "CANCELLED" ? null : buyer.id,
          shippingBundleId: status === "CANCELLED" ? null : bundle.id,
        },
      });
    }

    console.log(`  ✓ [${status}] ${cards.length} kaarten van ${seller.displayName} — €${(totalItemCost + shippingCost).toFixed(2)} (${daysAgo}d geleden)`);
  }

  // --- PAID orders (recent, not yet shipped) ---
  console.log("📦 Creating PAID orders...");

  if (sellers[0]) {
    await createPurchase({
      seller: sellers[0],
      status: "PAID",
      daysAgo: 2,
      shippingCost: 5.70,
      cards: [
        { name: "Charizard VMAX", condition: "Near Mint", price: 45 },
        { name: "Pikachu V", condition: "Near Mint", price: 8 },
        { name: "Umbreon V", condition: "Lightly Played", price: 12 },
      ],
    });
  }

  if (sellers[1]) {
    await createPurchase({
      seller: sellers[1],
      status: "PAID",
      daysAgo: 5,
      shippingCost: 8.75,
      cards: [
        { name: "Mew ex SAR", condition: "Near Mint", price: 55 },
      ],
    });
  }

  // PAID but >7 days (can be cancelled)
  if (sellers[2]) {
    await createPurchase({
      seller: sellers[2],
      status: "PAID",
      daysAgo: 10,
      shippingCost: 5.70,
      cards: [
        { name: "Gardevoir ex SAR", condition: "Near Mint", price: 42 },
        { name: "Iono SAR", condition: "Near Mint", price: 38 },
      ],
    });
  }

  // --- SHIPPED orders ---
  console.log("\n🚚 Creating SHIPPED orders...");

  if (sellers[3]) {
    await createPurchase({
      seller: sellers[3],
      status: "SHIPPED",
      daysAgo: 4,
      shippingCost: 11.25,
      cards: [
        { name: "Shining Gyarados", condition: "Lightly Played", price: 85 },
        { name: "Lugia Neo Genesis", condition: "Moderately Played", price: 120 },
      ],
    });
  }

  if (sellers[0]) {
    await createPurchase({
      seller: sellers[0],
      status: "SHIPPED",
      daysAgo: 6,
      shippingCost: 8.75,
      cards: [
        { name: "Rayquaza VMAX Alt Art", condition: "Near Mint", price: 165 },
      ],
    });
  }

  // --- COMPLETED orders ---
  console.log("\n✅ Creating COMPLETED orders...");

  if (sellers[4]) {
    await createPurchase({
      seller: sellers[4],
      status: "COMPLETED",
      daysAgo: 21,
      shippingCost: 5.70,
      cards: [
        { name: "Umbreon VMAX Alt Art", condition: "Near Mint", price: 220 },
        { name: "Espeon VMAX Alt Art", condition: "Near Mint", price: 45 },
        { name: "Sylveon VMAX", condition: "Near Mint", price: 18 },
      ],
    });
  }

  if (sellers[1]) {
    await createPurchase({
      seller: sellers[1],
      status: "COMPLETED",
      daysAgo: 35,
      shippingCost: 5.70,
      cards: [
        { name: "Charizard ex IR 151", condition: "Near Mint", price: 95 },
      ],
    });
  }

  if (sellers[2]) {
    await createPurchase({
      seller: sellers[2],
      status: "COMPLETED",
      daysAgo: 60,
      shippingCost: 8.75,
      cards: [
        { name: "Pikachu ex SAR", condition: "Near Mint", price: 52 },
        { name: "Eevee IR", condition: "Near Mint", price: 22 },
      ],
    });
  }

  // --- CANCELLED orders ---
  console.log("\n❌ Creating CANCELLED orders...");

  if (sellers[3]) {
    await createPurchase({
      seller: sellers[3],
      status: "CANCELLED",
      daysAgo: 15,
      shippingCost: 5.70,
      cards: [
        { name: "Dark Charizard Holo", condition: "Moderately Played", price: 65 },
        { name: "Dark Blastoise Holo", condition: "Lightly Played", price: 28 },
      ],
    });
  }

  if (sellers[0]) {
    await createPurchase({
      seller: sellers[0],
      status: "CANCELLED",
      daysAgo: 30,
      shippingCost: 11.25,
      cards: [
        { name: "Base Set Charizard Holo", condition: "Heavily Played", price: 150 },
      ],
    });
  }

  console.log("\n✅ Done! turrileo now has test purchases across all statuses.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
