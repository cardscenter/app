/**
 * One-shot fix: re-sync reservedBalance voor alle users met de nieuwe
 * recalculateTotalReserved-logica (Fase 27.98).
 *
 * Run: `npx tsx prisma/fix-reserves.ts`
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Importeer pas hier zodat de adapter-singleton consistent blijft
  const { recalculateTotalReserved } = await import("../src/lib/balance-check");

  const users = await prisma.user.findMany({
    where: { reservedBalance: { gt: 0 } },
    select: { id: true, displayName: true, reservedBalance: true },
  });

  console.log(`🔄 Re-syncing reservedBalance voor ${users.length} users met >0 reserve...\n`);

  for (const u of users) {
    const before = u.reservedBalance;
    const after = await recalculateTotalReserved(u.id);
    const diff = after - before;
    const sign = diff > 0 ? "+" : "";
    await prisma.user.update({
      where: { id: u.id },
      data: { reservedBalance: after },
    });
    console.log(
      `  ${u.displayName.padEnd(28)} €${before.toFixed(2).padStart(8)} → €${after.toFixed(2).padStart(8)}  (${sign}€${diff.toFixed(2)})`
    );
  }

  console.log("\n✅ Klaar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
