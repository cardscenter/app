import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: "file:dev.db" }) });
const amount = parseFloat(process.argv[2] ?? "0");

async function main() {
  const user = await prisma.user.findFirst({ where: { displayName: "atomicsnipz" } });
  if (!user) { console.log("Not found"); return; }
  await prisma.user.update({ where: { id: user.id }, data: { balance: amount } });
  console.log("Balance set to", amount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
