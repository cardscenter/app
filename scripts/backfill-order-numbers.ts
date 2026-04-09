import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

function generateOrderNumber(createdAt: Date): string {
  const d = createdAt;
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `ORD-${date}-${rand}`;
}

async function main() {
  const bundles = await prisma.shippingBundle.findMany({
    where: { orderNumber: "" },
    select: { id: true, createdAt: true },
  });

  console.log(`Found ${bundles.length} bundles without order number`);

  const usedNumbers = new Set<string>();

  for (const bundle of bundles) {
    let orderNumber: string;
    do {
      orderNumber = generateOrderNumber(bundle.createdAt);
    } while (usedNumbers.has(orderNumber));
    usedNumbers.add(orderNumber);

    await prisma.shippingBundle.update({
      where: { id: bundle.id },
      data: { orderNumber },
    });
    console.log(`  ${bundle.id} → ${orderNumber}`);
  }

  // Now add the unique index if it doesn't exist yet
  try {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ShippingBundle_orderNumber_key" ON "ShippingBundle"("orderNumber")`);
    console.log("\n✓ Unique index created/verified");
  } catch (e: any) {
    console.log("\n! Index already exists or error:", e.message?.slice(0, 100));
  }

  console.log("\n✅ Done!");
  await prisma.$disconnect();
}
main();
