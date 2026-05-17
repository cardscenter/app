// Fase 40 — eenmalige migratie voor pre-Fase-28 claimsale-bundles.
//
// CONTEXT: tot Fase 28 werd bij claimsale-checkout de shippingCost wel van de
// buyer afgeschreven, maar niet aan seller.heldBalance toegevoegd. Bij refund/
// cancel kreeg de buyer wel z'n volledige bedrag terug — geld kwam dus uit
// het niets. Fase 28 fixte de nieuwe flow; deze migratie corrigeert achteraf
// de bestaande PAID/SHIPPED claimsale-bundles van vóór de fix.
//
// WAT DOET DIT SCRIPT:
//  Voor elke ShippingBundle die voldoet aan:
//    - status: PAID | SHIPPED
//    - shippingCost > 0
//    - is een claimsale-bundle (geen auctionId, geen listingId, geen
//      bundleProposalId, items.length > 0)
//    - geen eerdere correctie (Transaction.description LIKE 'Pre-Fase28
//      shipping-fix%')
//  Verhoogt seller.heldBalance met bundle.shippingCost.
//  Schrijft een audit-Transaction-rij voor traceerbaarheid.
//
// MODE:
//  Default = dry-run. Loopt door, print wat er zou gebeuren, geen mutaties.
//  --apply  = echt uitvoeren. Print elke mutatie + samenvatting.
//
// USAGE:
//  npx tsx scripts/fix-pre-fase28-heldbalance.ts          # dry-run
//  npx tsx scripts/fix-pre-fase28-heldbalance.ts --apply  # echt mutateren

import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");
const MARKER = "Pre-Fase28 shipping-fix";

async function main() {
  console.log(APPLY ? "=== APPLY MODE — echte mutaties ===" : "=== DRY-RUN — geen mutaties ===");
  console.log("Zoekt PAID/SHIPPED claimsale-bundles met shippingCost > 0 zonder eerdere correctie...\n");

  const candidates = await prisma.shippingBundle.findMany({
    where: {
      status: { in: ["PAID", "SHIPPED"] },
      shippingCost: { gt: 0 },
      auctionId: null,
      listingId: null,
      bundleProposalId: null,
      items: { some: {} },
    },
    select: {
      id: true,
      orderNumber: true,
      sellerId: true,
      shippingCost: true,
      status: true,
      createdAt: true,
      seller: { select: { displayName: true, heldBalance: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (candidates.length === 0) {
    console.log("Geen bundles gevonden die aan de criteria voldoen.");
    return;
  }

  console.log(`Gevonden: ${candidates.length} kandidaten.\n`);

  let alreadyFixed = 0;
  let toFix = 0;
  let totalAmount = 0;

  for (const bundle of candidates) {
    // Idempotency-check: bestaat er al een correctie-Transaction voor deze bundle?
    const existing = await prisma.transaction.findFirst({
      where: {
        userId: bundle.sellerId,
        relatedShippingBundleId: bundle.id,
        description: { startsWith: MARKER },
      },
    });

    if (existing) {
      alreadyFixed++;
      continue;
    }

    toFix++;
    totalAmount += bundle.shippingCost;
    console.log(
      `[${bundle.status}] ${bundle.orderNumber} | seller=${bundle.seller.displayName} | heldBalance €${bundle.seller.heldBalance.toFixed(2)} +€${bundle.shippingCost.toFixed(2)}`,
    );

    if (APPLY) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: bundle.sellerId },
          data: { heldBalance: { increment: bundle.shippingCost } },
        }),
        prisma.transaction.create({
          data: {
            userId: bundle.sellerId,
            type: "ESCROW_HOLD",
            amount: bundle.shippingCost,
            // balanceBefore/After: balance verandert niet, alleen heldBalance.
            // We schrijven de PRE-fix balance op beide velden voor consistentie.
            balanceBefore: 0,
            balanceAfter: 0,
            description: `${MARKER}: shipping-correctie ${bundle.orderNumber}`,
            relatedShippingBundleId: bundle.id,
          },
        }),
      ]);
    }
  }

  console.log(`\n=== Samenvatting ===`);
  console.log(`Totaal kandidaten: ${candidates.length}`);
  console.log(`Al gecorrigeerd (idempotency-hit): ${alreadyFixed}`);
  console.log(`Te corrigeren: ${toFix}`);
  console.log(`Totaal heldBalance-toename: €${totalAmount.toFixed(2)}`);
  if (!APPLY) {
    console.log(`\nDit was een dry-run. Run met --apply om te muteren.`);
  } else {
    console.log(`\nMutaties uitgevoerd. Audit-trail in Transaction met description-prefix "${MARKER}".`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
