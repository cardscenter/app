import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const b = await prisma.shippingBundle.findFirst({ select: { id: true, orderNumber: true } });
    console.log("orderNumber field EXISTS. Sample:", b);
  } catch (e: any) {
    console.log("orderNumber field MISSING:", e.message?.slice(0, 200));
  }
  await prisma.$disconnect();
}
main();
