/**
 * Fase 28 testdata-seeder voor user "27Buyer".
 *
 * Genereert claimsale-bundles in beide richtingen (27Buyer als buyer EN als
 * seller), in verschillende statuses, met 20+ items per bundle. Doel: alle
 * orderdetails-modal-varianten kunnen visueel testen — timeline-states,
 * sortering op grote lijsten, refund-historie, partial refunds, CANCELLED.
 *
 * Idempotent: alle gemaakte claimsales hebben titel-prefix "[F28-test]" en
 * worden bij elke run opgeruimd voor opnieuw genereren.
 *
 * Run: `npx tsx scripts/seed-27buyer-testdata.ts`
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const F28_TAG = "[F28-test]";

const CARD_TEMPLATES = [
  { name: "Charizard ex", basePrice: 45 },
  { name: "Pikachu V", basePrice: 8 },
  { name: "Umbreon V", basePrice: 12 },
  { name: "Mew ex SAR", basePrice: 55 },
  { name: "Gardevoir ex", basePrice: 28 },
  { name: "Iono SAR", basePrice: 38 },
  { name: "Rayquaza VMAX", basePrice: 45 },
  { name: "Lugia Neo", basePrice: 22 },
  { name: "Sylveon VMAX", basePrice: 18 },
  { name: "Espeon VMAX", basePrice: 35 },
  { name: "Greninja ex", basePrice: 14 },
  { name: "Lucario V", basePrice: 6 },
  { name: "Zacian V", basePrice: 10 },
  { name: "Zamazenta V", basePrice: 8 },
  { name: "Snorlax V", basePrice: 5 },
  { name: "Eevee Heroes", basePrice: 25 },
  { name: "Latios ex", basePrice: 16 },
  { name: "Latias ex", basePrice: 14 },
  { name: "Mewtwo ex", basePrice: 32 },
  { name: "Iron Hands ex", basePrice: 4 },
  { name: "Roaring Moon ex", basePrice: 9 },
  { name: "Trekking Shoes", basePrice: 2 },
  { name: "Boss's Orders", basePrice: 1.5 },
  { name: "Professor's Research", basePrice: 0.8 },
  { name: "Pokégear 3.0", basePrice: 1.2 },
  { name: "Energy Retrieval", basePrice: 0.5 },
  { name: "Quick Ball", basePrice: 0.3 },
  { name: "Ultra Ball", basePrice: 0.4 },
  { name: "Switch", basePrice: 0.2 },
  { name: "Rare Candy", basePrice: 1.8 },
  { name: "Maximum Belt", basePrice: 0.9 },
  { name: "Buddy-Buddy Poffin", basePrice: 2.2 },
  { name: "Iron Bundle ex", basePrice: 11 },
  { name: "Walking Wake ex", basePrice: 24 },
  { name: "Forest Seal Stone", basePrice: 1.4 },
  { name: "Magnezone ex", basePrice: 6 },
  { name: "Gholdengo ex", basePrice: 18 },
  { name: "Dragapult ex", basePrice: 22 },
  { name: "Hisuian Zoroark", basePrice: 9 },
  { name: "Heatran ex", basePrice: 1.5 },
];

const CONDITIONS = ["Mint", "Near Mint", "Near Mint", "Near Mint", "Excellent", "Lightly Played", "Played"];
const CARRIERS = ["PostNL", "DHL", "DPD"];
const SERVICES = ["Aangetekend Pakket", "Briefpost", "Pakket tracked"];

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randPrice(base: number): number {
  return Math.round(base * (0.7 + Math.random() * 0.6) * 100) / 100;
}

function genItems(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const tpl = randItem(CARD_TEMPLATES);
    return {
      cardName: `${tpl.name} #${String(((i % 199) + 1)).padStart(3, "0")}`,
      reference: `${String(i + 1).padStart(3, "0")}/200`,
      condition: randItem(CONDITIONS),
      price: randPrice(tpl.basePrice),
    };
  });
}

function genOrderNumber(): string {
  return `F28-${Date.now().toString(36).toUpperCase().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function cleanupOldData() {
  console.log("→ Opruimen oude [F28-test] data...");
  const oldSales = await prisma.claimsale.findMany({
    where: { title: { startsWith: F28_TAG } },
    select: { id: true },
  });
  if (oldSales.length === 0) {
    console.log("  (niets gevonden om op te ruimen)");
    return;
  }
  const saleIds = oldSales.map((s) => s.id);

  const oldItems = await prisma.claimsaleItem.findMany({
    where: { claimsaleId: { in: saleIds } },
    select: { shippingBundleId: true },
  });
  const bundleIds = [
    ...new Set(oldItems.map((i) => i.shippingBundleId).filter((id): id is string => id !== null)),
  ];

  // Delete in dependency order
  await prisma.claimsaleItem.deleteMany({ where: { claimsaleId: { in: saleIds } } });
  if (bundleIds.length > 0) {
    await prisma.cancellationRequest.deleteMany({ where: { shippingBundleId: { in: bundleIds } } }).catch(() => {});
    await prisma.dispute.deleteMany({ where: { shippingBundleId: { in: bundleIds } } }).catch(() => {});
    await prisma.shippingBundle.deleteMany({ where: { id: { in: bundleIds } } });
  }
  await prisma.claimsale.deleteMany({ where: { id: { in: saleIds } } });
  console.log(`  ✓ ${saleIds.length} claimsales + ${bundleIds.length} bundles + ${oldItems.length} items verwijderd`);
}

type BundleConfig = {
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  status: "PAID" | "SHIPPED" | "COMPLETED" | "CANCELLED";
  itemCount: number;
  daysAgo: number;
  /** Aantal items dat als refunded gemarkeerd wordt (alleen geldig op SHIPPED/COMPLETED) */
  refundItemCount?: number;
  /** Extra custom-amount refund (bovenop item-refunds) */
  refundExtra?: number;
};

async function createBundle(cfg: BundleConfig) {
  const purchaseDate = new Date(Date.now() - cfg.daysAgo * 24 * 60 * 60 * 1000);
  const items = genItems(cfg.itemCount);
  const totalItemCost = Math.round(items.reduce((s, c) => s + c.price, 0) * 100) / 100;
  const shippingCost = randItem([4.95, 5.7, 6.5, 7.95, 8.75]);
  const totalCost = Math.round((totalItemCost + shippingCost) * 100) / 100;

  // Claimsale (publishedAt iets vóór purchaseDate)
  const claimsale = await prisma.claimsale.create({
    data: {
      title: `${F28_TAG} ${cfg.sellerName} — ${items[0].cardName.split(" #")[0]} e.a.`,
      description: "Testdata voor Fase 28 orderdetails-modal",
      shippingCost,
      status: cfg.status === "CANCELLED" ? "LIVE" : "CLOSED",
      publishedAt: new Date(purchaseDate.getTime() - 2 * 24 * 60 * 60 * 1000),
      sellerId: cfg.sellerId,
    },
  });

  // Timestamps per status
  const shippedAt =
    cfg.status === "SHIPPED" ? new Date(purchaseDate.getTime() + 2 * 24 * 60 * 60 * 1000) :
    cfg.status === "COMPLETED" ? new Date(purchaseDate.getTime() + 1 * 24 * 60 * 60 * 1000) :
    null;
  const deliveredAt =
    cfg.status === "COMPLETED" ? new Date(purchaseDate.getTime() + 5 * 24 * 60 * 60 * 1000) :
    null;
  const trackingUrl =
    cfg.status === "SHIPPED" || cfg.status === "COMPLETED"
      ? "https://postnl.nl/tracktrace/T0000000000NL"
      : null;
  const carrier = trackingUrl ? randItem(CARRIERS) : null;
  const serviceName = trackingUrl ? randItem(SERVICES) : null;

  // Find a shipping method on seller (optional — kan null zijn)
  const sellerMethods = await prisma.sellerShippingMethod.findMany({
    where: { sellerId: cfg.sellerId, isActive: true },
    take: 1,
  });
  let shippingMethodId = sellerMethods[0]?.id ?? null;

  // Als geen seller-shipping-method, maak een tijdelijke aan zodat carrier+service in de modal zichtbaar zijn
  if (!shippingMethodId && carrier && serviceName) {
    const ssm = await prisma.sellerShippingMethod.create({
      data: {
        sellerId: cfg.sellerId,
        carrier,
        serviceName,
        price: shippingCost,
        isTracked: true,
        isActive: false, // niet actief in marktplaats — alleen voor bundle-snapshot
        countries: JSON.stringify(["NL", "BE", "DE"]),
      },
    });
    shippingMethodId = ssm.id;
  }

  // Refund-berekening
  const refundItemCount = cfg.refundItemCount ?? 0;
  const refundedItemPrices = items.slice(0, refundItemCount).reduce((s, c) => s + c.price, 0);
  const refundExtra = cfg.refundExtra ?? 0;
  const refundedAmount = Math.round((refundedItemPrices + refundExtra) * 100) / 100;

  // Bundle
  const bundle = await prisma.shippingBundle.create({
    data: {
      orderNumber: genOrderNumber(),
      buyerId: cfg.buyerId,
      sellerId: cfg.sellerId,
      shippingCost,
      totalItemCost,
      totalCost,
      status: cfg.status,
      paymentMode: "PLATFORM",
      deliveryMethod: "SHIP",
      shippingMethodId,
      trackingUrl,
      shippedAt,
      deliveredAt,
      refundedAmount,
      buyerStreet: "Teststraat",
      buyerHouseNumber: `${10 + Math.floor(Math.random() * 90)}`,
      buyerPostalCode: `${1000 + Math.floor(Math.random() * 8999)} AB`,
      buyerCity: randItem(["Amsterdam", "Rotterdam", "Utrecht", "Eindhoven", "Den Haag"]),
      buyerCountry: "NL",
      createdAt: purchaseDate,
      updatedAt: purchaseDate,
    },
  });

  // Items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isRefunded = i < refundItemCount;
    await prisma.claimsaleItem.create({
      data: {
        claimsaleId: claimsale.id,
        cardName: item.cardName,
        reference: item.reference,
        condition: item.condition,
        price: item.price,
        imageUrls: JSON.stringify([]),
        status: cfg.status === "CANCELLED" ? "AVAILABLE" : "SOLD",
        buyerId: cfg.status === "CANCELLED" ? null : cfg.buyerId,
        shippingBundleId: cfg.status === "CANCELLED" ? null : bundle.id,
        refundedAt: isRefunded ? new Date(purchaseDate.getTime() + 3 * 24 * 60 * 60 * 1000) : null,
        claimedAt: cfg.status === "CANCELLED" ? null : new Date(purchaseDate.getTime() - 1 * 60 * 60 * 1000),
        createdAt: new Date(purchaseDate.getTime() - 4 * 24 * 60 * 60 * 1000 + i * 1000),
      },
    });
  }

  console.log(
    `  ✓ ${cfg.status.padEnd(9)} ${cfg.itemCount}× items   €${totalCost.toFixed(2).padStart(8)}` +
    (refundedAmount > 0 ? `   refund €${refundedAmount.toFixed(2)}` : "") +
    `   ${cfg.buyerName} ← ${cfg.sellerName}`,
  );
}

async function main() {
  console.log("🌱 Fase 28 testdata-seeder voor 27Buyer\n");

  const buyer = await prisma.user.findUnique({ where: { email: "buyer@fase27.test" } });
  const seller = await prisma.user.findUnique({ where: { email: "seller@fase27.test" } });
  const buyer2 = await prisma.user.findUnique({ where: { email: "buyer2@fase27.test" } });
  if (!buyer || !seller || !buyer2) {
    throw new Error("Test-users niet gevonden — run eerst `npx tsx prisma/seed-fase27.ts`");
  }
  console.log(`✓ buyer  = ${buyer.displayName}  (${buyer.email})`);
  console.log(`✓ seller = ${seller.displayName} (${seller.email})`);
  console.log(`✓ buyer2 = ${buyer2.displayName} (${buyer2.email})\n`);

  await cleanupOldData();
  console.log("");

  // ─── 27Buyer ALS BUYER (zichtbaar in /dashboard/aankopen) ─────────────
  console.log("📦 Aankopen (27Buyer = buyer):");
  await createBundle({ buyerId: buyer.id, buyerName: buyer.displayName, sellerId: seller.id, sellerName: seller.displayName, status: "PAID", itemCount: 22, daysAgo: 1 });
  await createBundle({ buyerId: buyer.id, buyerName: buyer.displayName, sellerId: seller.id, sellerName: seller.displayName, status: "PAID", itemCount: 35, daysAgo: 3 });
  await createBundle({ buyerId: buyer.id, buyerName: buyer.displayName, sellerId: seller.id, sellerName: seller.displayName, status: "SHIPPED", itemCount: 25, daysAgo: 4 });
  await createBundle({ buyerId: buyer.id, buyerName: buyer.displayName, sellerId: seller.id, sellerName: seller.displayName, status: "SHIPPED", itemCount: 28, daysAgo: 5, refundItemCount: 2, refundExtra: 0.5 });
  await createBundle({ buyerId: buyer.id, buyerName: buyer.displayName, sellerId: seller.id, sellerName: seller.displayName, status: "COMPLETED", itemCount: 32, daysAgo: 18 });
  await createBundle({ buyerId: buyer.id, buyerName: buyer.displayName, sellerId: seller.id, sellerName: seller.displayName, status: "COMPLETED", itemCount: 21, daysAgo: 22, refundItemCount: 1 });
  await createBundle({ buyerId: buyer.id, buyerName: buyer.displayName, sellerId: seller.id, sellerName: seller.displayName, status: "CANCELLED", itemCount: 20, daysAgo: 8 });

  console.log("");

  // ─── 27Buyer ALS SELLER (zichtbaar in /dashboard/verkopen) ────────────
  console.log("💰 Verkopen (27Buyer = seller):");
  await createBundle({ buyerId: buyer2.id, buyerName: buyer2.displayName, sellerId: buyer.id, sellerName: buyer.displayName, status: "PAID", itemCount: 24, daysAgo: 2 });
  await createBundle({ buyerId: buyer2.id, buyerName: buyer2.displayName, sellerId: buyer.id, sellerName: buyer.displayName, status: "PAID", itemCount: 41, daysAgo: 6 });
  await createBundle({ buyerId: buyer2.id, buyerName: buyer2.displayName, sellerId: buyer.id, sellerName: buyer.displayName, status: "SHIPPED", itemCount: 22, daysAgo: 6 });
  await createBundle({ buyerId: buyer2.id, buyerName: buyer2.displayName, sellerId: buyer.id, sellerName: buyer.displayName, status: "SHIPPED", itemCount: 30, daysAgo: 9, refundItemCount: 1 });
  await createBundle({ buyerId: buyer2.id, buyerName: buyer2.displayName, sellerId: buyer.id, sellerName: buyer.displayName, status: "COMPLETED", itemCount: 26, daysAgo: 25 });
  await createBundle({ buyerId: buyer2.id, buyerName: buyer2.displayName, sellerId: buyer.id, sellerName: buyer.displayName, status: "CANCELLED", itemCount: 21, daysAgo: 11 });

  console.log("\n✅ Klaar — open /dashboard/aankopen en /dashboard/verkopen om te testen.");
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
