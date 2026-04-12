import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🎴 Seeding cosmetic chapters...");

  // Chapter 1 will be populated with in-house designed cosmetics (Fase C).
  // This seed intentionally leaves the bundle empty as a placeholder so the
  // schema stays consistent while art is produced.
  await prisma.cosmeticBundle.upsert({
    where: { key: "chapter-1-origins" },
    update: {
      name: "Chapter 1: Origins",
      description: "De eerste collectie cosmetics van Cards Center.",
      isActive: true,
      sortOrder: 1,
    },
    create: {
      key: "chapter-1-origins",
      name: "Chapter 1: Origins",
      description: "De eerste collectie cosmetics van Cards Center.",
      isActive: true,
      sortOrder: 1,
    },
  });

  console.log("✅ Chapter 1 placeholder created (no items yet).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
