/**
 * Migratie-script voor Fase 33 — verzending statisch.
 *
 * Voor elke user:
 * 1. Set alle bestaande SellerShippingMethod-records (legacy, zonder service+zone) op isActive=false.
 * 2. Roep setupStaticShippingMethods(userId) aan om de nieuwe statische slots aan te leggen.
 *
 * Users zonder User.country worden geskipped en geflagd via AdminAuditLog.
 *
 * Uitvoeren:
 *   - Stop dev server eerst
 *   - npx tsx scripts/migrate-shipping-v2.ts
 *   - Restart dev server
 */

import { prisma } from "../src/lib/prisma";
import { setupStaticShippingMethods } from "../src/actions/shipping-method";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, country: true, displayName: true, sellingCountries: true },
  });

  console.log(`Found ${users.length} users.`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.country) {
      console.log(`SKIP — ${user.displayName} (${user.id}): no User.country set`);
      skipped++;
      continue;
    }

    // 1. Set legacy methodes (zonder service+zone) op isActive=false
    const legacyDeactivated = await prisma.sellerShippingMethod.updateMany({
      where: {
        sellerId: user.id,
        OR: [{ service: null }, { zone: null }],
      },
      data: { isActive: false },
    });

    // 2. Roep setup aan om nieuwe statische slots aan te leggen (idempotent)
    await setupStaticShippingMethods(user.id);

    const newCount = await prisma.sellerShippingMethod.count({
      where: { sellerId: user.id, service: { not: null } },
    });

    console.log(
      `OK — ${user.displayName} (${user.id}, ${user.country}): ` +
        `${legacyDeactivated.count} legacy deactivated, ${newCount} static slots`,
    );
    migrated++;
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
