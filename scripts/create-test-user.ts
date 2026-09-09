/**
 * Dev-only: maak (of reset) een lokaal testaccount om mee in te loggen.
 *
 *   npx tsx scripts/create-test-user.ts                 → youri@test.nl / Test1234!
 *   npx tsx scripts/create-test-user.ts naam@test.nl Naam Wachtwoord1!
 *
 * Idempotent (upsert op e-mail). E-mail staat direct op geverifieerd, adres is
 * gevuld (handel-gates) en er staat €500 saldo op. Weigert op een libsql://-URL.
 */
import * as bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const url = process.env.DATABASE_URL ?? "file:dev.db";
if (url.startsWith("libsql://")) {
  console.error("Weiger: DATABASE_URL wijst naar een remote (Turso) database.");
  process.exit(1);
}

const [, , emailArg, nameArg, passwordArg] = process.argv;
const email = (emailArg ?? "youri@test.nl").trim().toLowerCase();
const displayName = (nameArg ?? "YouriTest").trim();
const password = passwordArg ?? "Test1234!";

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const ref = `${displayName.toLowerCase().replace(/[^a-z0-9]/g, "")}${String(Date.now()).slice(-10)}`;

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, emailVerifiedAt: new Date() },
    create: {
      email,
      passwordHash,
      displayName,
      firstName: "Youri",
      lastName: "Tester",
      emailVerifiedAt: new Date(),
      balance: 500,
      bankTransferReference: ref,
      street: "Teststraat",
      houseNumber: "1",
      postalCode: "1234AB",
      city: "Utrecht",
      country: "NL",
      sellingCountries: "DOMESTIC_AND_NEAR",
    },
    select: { id: true, email: true, displayName: true },
  });

  console.log(`Testaccount klaar: ${user.email} / ${password}  (@${user.displayName}, id ${user.id})`);
  console.log(`Profiel: http://localhost:3000/nl/verkoper/${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
