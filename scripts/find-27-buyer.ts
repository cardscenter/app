import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { displayName: { contains: "27" } },
        { email: { contains: "27" } },
        { firstName: { contains: "27" } },
      ],
    },
    select: { id: true, displayName: true, email: true, balance: true, accountType: true },
    take: 30,
  });
  console.log("Users matching '27':");
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
