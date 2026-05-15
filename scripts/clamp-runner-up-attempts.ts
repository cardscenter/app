// Eenmalige migratie: clamp `User.maxRunnerUpAttempts` naar maximaal 3.
// Bestaande users met de oude default (5) of een handmatig hogere waarde
// worden geflipt naar 3 zodat de nieuwe slider-cap consistent is.
//
// Run: `npx tsx scripts/clamp-runner-up-attempts.ts`

import { prisma } from "../src/lib/prisma";

async function main() {
  const before = await prisma.user.count({
    where: { maxRunnerUpAttempts: { gt: 3 } },
  });
  if (before === 0) {
    console.log("Geen users met maxRunnerUpAttempts > 3. Niks te doen.");
    return;
  }
  const result = await prisma.user.updateMany({
    where: { maxRunnerUpAttempts: { gt: 3 } },
    data: { maxRunnerUpAttempts: 3 },
  });
  console.log(`Geclampt: ${result.count} user(s) van >3 → 3.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
