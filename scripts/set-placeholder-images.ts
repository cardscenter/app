import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const img = "/images/placeholder.webp";

  const a = await prisma.auction.updateMany({ data: { imageUrls: img } });
  console.log("Auctions updated:", a.count);

  const l = await prisma.listing.updateMany({ data: { imageUrls: img } });
  console.log("Listings updated:", l.count);

  const ci = await prisma.claimsaleItem.updateMany({ data: { imageUrls: JSON.stringify([img]) } });
  console.log("Claimsale items updated:", ci.count);

  const counts = {
    auctions: await prisma.auction.count({ where: { status: "ACTIVE" } }),
    listings: await prisma.listing.count({ where: { status: "ACTIVE" } }),
    claimsales: await prisma.claimsale.count({ where: { status: "LIVE" } }),
  };
  console.log("Active counts:", counts);

  await prisma.$disconnect();
}

main().catch(console.error);
