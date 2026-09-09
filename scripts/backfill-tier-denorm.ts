// Eenmalige backfill (Fase 45): zet `User.tierRank` + `User.searchBoost`
// consistent met de tier-config voor alle bestaande accounts. Nodig na de
// introductie van `searchBoost` en na elke seed/set-admin die `accountType`
// direct schrijft zonder de denormalisatie-velden.
//
// Run: `npx tsx scripts/backfill-tier-denorm.ts`

import { prisma } from "../src/lib/prisma";
import { getTierDenormFields } from "../src/lib/subscription-tiers";

async function main() {
  const tiers = ["FREE", "PRO", "UNLIMITED", "ENTERPRISE", "ADMIN"] as const;
  for (const accountType of tiers) {
    const data = getTierDenormFields(accountType);
    const res = await prisma.user.updateMany({ where: { accountType }, data });
    console.log(`${accountType.padEnd(10)} → tierRank=${data.tierRank} searchBoost=${data.searchBoost} (${res.count} users)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
