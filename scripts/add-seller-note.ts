import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ClaimsaleItem" ADD COLUMN "sellerNote" TEXT`);
    console.log("✓ Added sellerNote column to ClaimsaleItem");
  } catch (e: any) {
    if (e.message?.includes("duplicate column")) {
      console.log("✓ sellerNote column already exists");
    } else {
      throw e;
    }
  }
  await prisma.$disconnect();
}
main();
