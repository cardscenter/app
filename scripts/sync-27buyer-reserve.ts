/**
 * Eenmalige sync van 27 buyer's reservedBalance na de stale-autobid fix.
 * Roept dezelfde logica aan als de productiecode (recalculateTotalReserved
 * via syncReservedBalance) zodat de DB matcht met de nieuwe regel:
 * "autobid telt alleen als hij het volgende minimum-bod kan halen".
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { syncReservedBalance } from "../src/lib/balance-check";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "buyer@fase27.test" },
    select: { id: true, displayName: true, balance: true, reservedBalance: true },
  });
  if (!user) throw new Error("27 Buyer niet gevonden");

  console.log(`Vóór sync — ${user.displayName}:`);
  console.log(`  balance:         €${user.balance.toFixed(2)}`);
  console.log(`  reservedBalance: €${user.reservedBalance.toFixed(2)}`);

  const newReserve = await syncReservedBalance(user.id);

  console.log(`\nNieuwe reservedBalance: €${newReserve.toFixed(2)}`);
  console.log(`Delta: €${(newReserve - user.reservedBalance).toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
