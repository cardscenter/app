import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: "file:dev.db" }) });

async function main() {
  const user = await prisma.user.findFirst({ where: { displayName: "atomicsnipz" } });
  if (!user) { console.log("Not found"); return; }

  console.log("Before:", { accountType: user.accountType, balance: user.balance });

  await prisma.user.update({
    where: { id: user.id },
    data: { accountType: "ADMIN", balance: 250 },
  });

  const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { accountType: true, balance: true } });
  console.log("After:", updated);
}

main().catch(console.error).finally(() => prisma.$disconnect());
