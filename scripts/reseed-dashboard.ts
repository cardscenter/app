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

  // Delete old test bundles (ones without orderNumber or with empty orderNumber from seed)
  const oldBundles = await prisma.shippingBundle.findMany({
    where: { OR: [{ buyerId: atomicsnipz.id }, { sellerId: atomicsnipz.id }] },
    select: { id: true },
  });

  // Delete disputes linked to these bundles first
  for (const b of oldBundles) {
    await prisma.dispute.deleteMany({ where: { shippingBundleId: b.id } });
  }

  await prisma.shippingBundle.deleteMany({
    where: { OR: [{ buyerId: atomicsnipz.id }, { sellerId: atomicsnipz.id }] },
  });
  console.log(`Deleted ${oldBundles.length} old bundles`);

  const bots = await prisma.user.findMany({
    where: { email: { not: "yourivankerkhoven@gmail.com" } },
    take: 6,
  });

  // Ensure addresses
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

  const now = new Date();

  // SALES (atomicsnipz = seller)
  console.log("\n💰 Sales:");
  for (const [i, data] of [
    { buyer: bots[0], cost: 25, ship: 4.95, status: "PAID" },
    { buyer: bots[1], cost: 89.99, ship: 6.50, status: "PAID" },
    { buyer: bots[2], cost: 15.50, ship: 4.95, status: "SHIPPED", daysAgo: 3 },
    { buyer: bots[3], cost: 45, ship: 4.95, status: "COMPLETED", daysAgo: 10, deliveredAgo: 5 },
  ].entries()) {
    const d = data as any;
    const b = await prisma.shippingBundle.create({
      data: {
        orderNumber: genOrder(now),
        buyerId: d.buyer.id,
        sellerId: atomicsnipz.id,
        shippingCost: d.ship,
        totalItemCost: d.cost,
        totalCost: d.cost + d.ship,
        status: d.status,
        trackingUrl: d.status !== "PAID" ? `https://postnl.nl/tracktrace/3STEST${100000+i}` : null,
        shippedAt: d.daysAgo ? new Date(now.getTime() - d.daysAgo * 86400000) : null,
        deliveredAt: d.deliveredAgo ? new Date(now.getTime() - d.deliveredAgo * 86400000) : null,
        buyerStreet: "Herengracht", buyerHouseNumber: String(40+i),
        buyerPostalCode: "1015BN", buyerCity: "Amsterdam", buyerCountry: "NL",
      },
    });
    console.log(`  ${b.orderNumber} ${d.status} (buyer: ${d.buyer.displayName})`);
  }

  // PURCHASES (atomicsnipz = buyer)
  console.log("\n📦 Purchases:");
  for (const [i, data] of [
    { seller: bots[0], cost: 35, ship: 4.95, status: "PAID" },
    { seller: bots[1], cost: 12.99, ship: 3.50, status: "PAID", createdDaysAgo: 8 },
    { seller: bots[2], cost: 67.50, ship: 4.95, status: "SHIPPED", daysAgo: 5 },
    { seller: bots[3], cost: 120, ship: 6.95, status: "SHIPPED", daysAgo: 15 },
    { seller: bots[4], cost: 29.99, ship: 4.95, status: "COMPLETED", daysAgo: 20, deliveredAgo: 14 },
    { seller: bots[5], cost: 8.50, ship: 4.95, status: "CANCELLED" },
  ].entries()) {
    const d = data as any;
    const createdAt = d.createdDaysAgo ? new Date(now.getTime() - d.createdDaysAgo * 86400000) : now;
    const b = await prisma.shippingBundle.create({
      data: {
        orderNumber: genOrder(createdAt),
        buyerId: atomicsnipz.id,
        sellerId: d.seller.id,
        shippingCost: d.ship,
        totalItemCost: d.cost,
        totalCost: d.cost + d.ship,
        status: d.status,
        createdAt,
        trackingUrl: d.daysAgo ? `https://postnl.nl/tracktrace/3STEST${200000+i}` : null,
        shippedAt: d.daysAgo ? new Date(now.getTime() - d.daysAgo * 86400000) : null,
        deliveredAt: d.deliveredAgo ? new Date(now.getTime() - d.deliveredAgo * 86400000) : null,
        buyerStreet: atomicsnipz.street!, buyerHouseNumber: atomicsnipz.houseNumber,
        buyerPostalCode: atomicsnipz.postalCode!, buyerCity: atomicsnipz.city!, buyerCountry: atomicsnipz.country,
      },
    });
    console.log(`  ${b.orderNumber} ${d.status} (seller: ${d.seller.displayName})`);
  }

  console.log("\n✅ Done! All bundles have order numbers.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
