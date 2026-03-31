import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Creating bulk dispute test data for atomicsnipz...\n");

  const atomicsnipz = await prisma.user.findFirst({
    where: { email: "yourivankerkhoven@gmail.com" },
  });
  if (!atomicsnipz) { console.error("❌ atomicsnipz not found!"); return; }

  const bots = await prisma.user.findMany({
    where: { email: { not: "yourivankerkhoven@gmail.com" } },
    take: 10,
  });
  if (bots.length < 5) { console.error("❌ Need more bot users"); return; }

  const addr = { buyerStreet: "Kalverstraat", buyerHouseNumber: "1", buyerPostalCode: "1012NX", buyerCity: "Amsterdam", buyerCountry: "NL" };
  const botAddrs = [
    { buyerStreet: "Oudegracht", buyerHouseNumber: "42", buyerPostalCode: "3511AB", buyerCity: "Utrecht", buyerCountry: "NL" },
    { buyerStreet: "Meir", buyerHouseNumber: "15", buyerPostalCode: "2000", buyerCity: "Antwerpen", buyerCountry: "BE" },
    { buyerStreet: "Kurfürstendamm", buyerHouseNumber: "8", buyerPostalCode: "10719", buyerCity: "Berlin", buyerCountry: "DE" },
    { buyerStreet: "Coolsingel", buyerHouseNumber: "77", buyerPostalCode: "3012AA", buyerCity: "Rotterdam", buyerCountry: "NL" },
    { buyerStreet: "Grote Markt", buyerHouseNumber: "3", buyerPostalCode: "9711LV", buyerCity: "Groningen", buyerCountry: "NL" },
  ];

  const reasons = ["NOT_RECEIVED", "NOT_AS_DESCRIBED", "DAMAGED_IN_TRANSIT"];
  const descriptions: Record<string, string[]> = {
    NOT_RECEIVED: [
      "Het pakket is nu al twee weken onderweg en ik heb nog steeds niks ontvangen. PostNL zegt dat het pakket niet gevonden kan worden.",
      "Volgens de verkoper is het pakket verstuurd, maar ik heb niks in de brievenbus gehad. Geen tracking beschikbaar.",
      "Al 3 weken wachten op mijn bestelling. De verkoper reageert niet meer op berichten.",
      "Pakket zou via DHL komen maar DHL heeft geen registratie van het zendnummer dat de verkoper heeft gegeven.",
      "Nooit ontvangen. De tracking laat zien 'afgeleverd' maar er is niks bezorgd bij mij.",
    ],
    NOT_AS_DESCRIBED: [
      "De kaarten zijn beschreven als Near Mint maar hebben duidelijke krassen op de holofoil. Dit is LP op z'n best.",
      "Ik heb een Charizard VMAX besteld maar heb een gewone Charizard V ontvangen. Verkeerde kaart gestuurd.",
      "De listing zei 'complete set' maar er missen 8 kaarten. Niet wat er beloofd was.",
      "Kaart werd aangeboden als 1st Edition maar het is een Unlimited print. Groot verschil in waarde.",
      "De foto's lieten een kaart in perfecte staat zien maar de kaart die ik ontving heeft een vouw in het midden.",
    ],
    DAMAGED_IN_TRANSIT: [
      "De kaarten zaten in een dunne envelop zonder bescherming. Alles is gebogen en beschadigd door de postbode.",
      "Het pakket was helemaal nat toen het aankwam. De kaarten zitten vast aan elkaar door waterschade.",
      "De toploader was gebroken tijdens transport en de kaart heeft een grote kras over de voorkant.",
      "Verpakking was totaal ingedeukt. Meerdere kaarten hebben vouwen en geknikte hoeken.",
      "De kaart zat los in een envelop zonder sleeve of toploader. Hoeken zijn allemaal beschadigd.",
    ],
  };
  const sellerResponses = [
    "Ik heb de kaarten zorgvuldig ingepakt en de staat was correct bij verzending. Ik heb foto's gemaakt voor verzending.",
    "Het pakket is correct verzonden met de juiste inhoud. Mogelijk is er iets misgegaan bij de bezorging.",
    "Ik begrijp de frustratie maar de kaarten waren in de beschreven staat. Ik ben bereid een gedeeltelijke terugbetaling te overwegen.",
    "Dit is de eerste keer dat ik zo'n klacht krijg na 50+ verkopen. De foto's in de listing zijn van de exacte kaart die verstuurd is.",
    "Ik heb alles dubbel gecheckt voor verzending. De verpakking was stevig. Als er transportschade is, is dat niet mijn schuld.",
  ];

  let buyerCount = 0;
  let sellerCount = 0;

  // ============================================================
  // AS BUYER (atomicsnipz bought from bots) — 10 disputes
  // ============================================================
  console.log("📦 Creating disputes as BUYER...");

  // 1-3: OPEN disputes
  for (let i = 0; i < 3; i++) {
    const bot = bots[i % bots.length];
    const reason = reasons[i];
    const bundle = await prisma.shippingBundle.create({
      data: {
        buyerId: atomicsnipz.id, sellerId: bot.id, status: "DISPUTED",
        shippingCost: 4.95, totalItemCost: 20 + i * 15, totalCost: 24.95 + i * 15,
        shippedAt: new Date(Date.now() - (14 + i) * 86400000),
        ...addr, createdAt: new Date(Date.now() - (18 + i) * 86400000),
      },
    });
    await prisma.dispute.create({
      data: {
        shippingBundleId: bundle.id, openedById: atomicsnipz.id,
        reason, description: descriptions[reason][i],
        evidenceUrls: "[]", status: "OPEN",
        responseDeadline: new Date(Date.now() + (3 + i) * 86400000),
        createdAt: new Date(Date.now() - (4 - i) * 86400000),
      },
    });
    buyerCount++;
    console.log(`  ✓ OPEN #${buyerCount}: ${reason} vs ${bot.displayName}`);
  }

  // 4-6: SELLER_RESPONDED disputes
  for (let i = 0; i < 3; i++) {
    const bot = bots[(i + 3) % bots.length];
    const reason = reasons[i];
    const bundle = await prisma.shippingBundle.create({
      data: {
        buyerId: atomicsnipz.id, sellerId: bot.id, status: "DISPUTED",
        shippingCost: 6.50, totalItemCost: 35 + i * 20, totalCost: 41.50 + i * 20,
        trackingUrl: i === 0 ? "https://postnl.nl/tracktrace/TAAA" + i : null,
        shippedAt: new Date(Date.now() - (16 + i) * 86400000),
        ...addr, createdAt: new Date(Date.now() - (20 + i) * 86400000),
      },
    });
    await prisma.dispute.create({
      data: {
        shippingBundleId: bundle.id, openedById: atomicsnipz.id,
        reason, description: descriptions[reason][i + 1],
        evidenceUrls: "[]", status: "SELLER_RESPONDED",
        sellerResponse: sellerResponses[i],
        sellerRespondedAt: new Date(Date.now() - (1 + i) * 86400000),
        responseDeadline: new Date(Date.now() - 1 * 86400000),
        buyerReviewDeadline: new Date(Date.now() + (5 + i) * 86400000),
        partialRefundAmount: i === 1 ? 25.00 : null,
        proposedById: i === 1 ? bot.id : null,
        createdAt: new Date(Date.now() - (8 + i) * 86400000),
      },
    });
    buyerCount++;
    console.log(`  ✓ SELLER_RESPONDED #${buyerCount}: ${reason} vs ${bot.displayName}${i === 1 ? " (voorstel €25)" : ""}`);
  }

  // 7: ESCALATED dispute
  {
    const bot = bots[1];
    const bundle = await prisma.shippingBundle.create({
      data: {
        buyerId: atomicsnipz.id, sellerId: bot.id, status: "DISPUTED",
        shippingCost: 4.95, totalItemCost: 120, totalCost: 124.95,
        trackingUrl: "https://dhl.nl/track/ESC001",
        shippedAt: new Date(Date.now() - 20 * 86400000),
        ...addr, createdAt: new Date(Date.now() - 25 * 86400000),
      },
    });
    await prisma.dispute.create({
      data: {
        shippingBundleId: bundle.id, openedById: atomicsnipz.id,
        reason: "NOT_AS_DESCRIBED", description: descriptions.NOT_AS_DESCRIBED[4],
        evidenceUrls: "[]", status: "ESCALATED",
        sellerResponse: sellerResponses[3],
        sellerRespondedAt: new Date(Date.now() - 10 * 86400000),
        responseDeadline: new Date(Date.now() - 13 * 86400000),
        buyerReviewDeadline: new Date(Date.now() - 3 * 86400000),
        buyerAcceptsEscalation: true, sellerAcceptsEscalation: true,
        createdAt: new Date(Date.now() - 15 * 86400000),
      },
    });
    buyerCount++;
    console.log(`  ✓ ESCALATED #${buyerCount}: NOT_AS_DESCRIBED vs ${bot.displayName}`);
  }

  // 8-10: RESOLVED disputes (mix)
  const resolvedConfigs = [
    { status: "RESOLVED_BUYER", resolution: "REFUND_FULL", reason: "NOT_RECEIVED", days: 30 },
    { status: "RESOLVED_SELLER", resolution: "NO_REFUND", reason: "NOT_AS_DESCRIBED", days: 25 },
    { status: "RESOLVED_MUTUAL", resolution: "MUTUAL_AGREEMENT", reason: "DAMAGED_IN_TRANSIT", days: 20, partial: 15 },
  ];
  for (let i = 0; i < 3; i++) {
    const cfg = resolvedConfigs[i];
    const bot = bots[(i + 2) % bots.length];
    const itemCost = 30 + i * 25;
    const bundle = await prisma.shippingBundle.create({
      data: {
        buyerId: atomicsnipz.id, sellerId: bot.id,
        status: cfg.status === "RESOLVED_BUYER" ? "CANCELLED" : "COMPLETED",
        shippingCost: 4.95, totalItemCost: itemCost, totalCost: itemCost + 4.95,
        shippedAt: new Date(Date.now() - (cfg.days + 10) * 86400000),
        deliveredAt: cfg.status !== "RESOLVED_BUYER" ? new Date(Date.now() - cfg.days * 86400000) : null,
        ...addr, createdAt: new Date(Date.now() - (cfg.days + 15) * 86400000),
      },
    });
    await prisma.dispute.create({
      data: {
        shippingBundleId: bundle.id, openedById: atomicsnipz.id,
        reason: cfg.reason, description: descriptions[cfg.reason][i + 2],
        evidenceUrls: "[]", status: cfg.status,
        resolution: cfg.resolution,
        sellerResponse: sellerResponses[i + 2],
        sellerRespondedAt: new Date(Date.now() - (cfg.days + 3) * 86400000),
        resolvedAt: new Date(Date.now() - cfg.days * 86400000),
        responseDeadline: new Date(Date.now() - (cfg.days + 7) * 86400000),
        partialRefundAmount: cfg.partial ?? null,
        createdAt: new Date(Date.now() - (cfg.days + 5) * 86400000),
      },
    });
    buyerCount++;
    console.log(`  ✓ ${cfg.status} #${buyerCount}: ${cfg.reason} vs ${bot.displayName}`);
  }

  // ============================================================
  // AS SELLER (bots bought from atomicsnipz) — 10 disputes
  // ============================================================
  console.log("\n💰 Creating disputes as SELLER...");

  // 1-3: OPEN disputes (bots opened against atomicsnipz)
  for (let i = 0; i < 3; i++) {
    const bot = bots[i % bots.length];
    const reason = reasons[i];
    const itemCost = 25 + i * 10;
    const bundle = await prisma.shippingBundle.create({
      data: {
        buyerId: bot.id, sellerId: atomicsnipz.id, status: "DISPUTED",
        shippingCost: 3.50, totalItemCost: itemCost, totalCost: itemCost + 3.50,
        trackingUrl: i === 2 ? "https://postnl.nl/tracktrace/TSEL" + i : null,
        shippedAt: new Date(Date.now() - (13 + i) * 86400000),
        ...botAddrs[i % botAddrs.length],
        createdAt: new Date(Date.now() - (17 + i) * 86400000),
      },
    });
    await prisma.dispute.create({
      data: {
        shippingBundleId: bundle.id, openedById: bot.id,
        reason, description: descriptions[reason][i + 2],
        evidenceUrls: "[]", status: "OPEN",
        responseDeadline: new Date(Date.now() + (4 + i) * 86400000),
        createdAt: new Date(Date.now() - (3 - i) * 86400000),
      },
    });
    sellerCount++;
    console.log(`  ✓ OPEN #${sellerCount}: ${reason} by ${bot.displayName}`);
  }

  // 4-6: SELLER_RESPONDED (atomicsnipz already responded)
  for (let i = 0; i < 3; i++) {
    const bot = bots[(i + 3) % bots.length];
    const reason = reasons[(i + 1) % 3];
    const itemCost = 40 + i * 15;
    const bundle = await prisma.shippingBundle.create({
      data: {
        buyerId: bot.id, sellerId: atomicsnipz.id, status: "DISPUTED",
        shippingCost: 6.50, totalItemCost: itemCost, totalCost: itemCost + 6.50,
        trackingUrl: "https://postnl.nl/tracktrace/TRES" + i,
        shippedAt: new Date(Date.now() - (18 + i) * 86400000),
        ...botAddrs[(i + 1) % botAddrs.length],
        createdAt: new Date(Date.now() - (22 + i) * 86400000),
      },
    });
    await prisma.dispute.create({
      data: {
        shippingBundleId: bundle.id, openedById: bot.id,
        reason, description: descriptions[reason][i],
        evidenceUrls: "[]", status: "SELLER_RESPONDED",
        sellerResponse: sellerResponses[i + 1],
        sellerRespondedAt: new Date(Date.now() - (2 + i) * 86400000),
        responseDeadline: new Date(Date.now() - 2 * 86400000),
        buyerReviewDeadline: new Date(Date.now() + (4 + i) * 86400000),
        partialRefundAmount: i === 2 ? 20.00 : null,
        proposedById: i === 2 ? atomicsnipz.id : null,
        createdAt: new Date(Date.now() - (9 + i) * 86400000),
      },
    });
    sellerCount++;
    console.log(`  ✓ SELLER_RESPONDED #${sellerCount}: ${reason} by ${bot.displayName}${i === 2 ? " (jij stelde €20 voor)" : ""}`);
  }

  // 7: ESCALATED
  {
    const bot = bots[4];
    const bundle = await prisma.shippingBundle.create({
      data: {
        buyerId: bot.id, sellerId: atomicsnipz.id, status: "DISPUTED",
        shippingCost: 4.95, totalItemCost: 95, totalCost: 99.95,
        trackingUrl: "https://dhl.nl/track/ESC002",
        shippedAt: new Date(Date.now() - 22 * 86400000),
        ...botAddrs[4], createdAt: new Date(Date.now() - 27 * 86400000),
      },
    });
    await prisma.dispute.create({
      data: {
        shippingBundleId: bundle.id, openedById: bot.id,
        reason: "DAMAGED_IN_TRANSIT", description: descriptions.DAMAGED_IN_TRANSIT[3],
        evidenceUrls: "[]", status: "ESCALATED",
        sellerResponse: sellerResponses[4],
        sellerRespondedAt: new Date(Date.now() - 12 * 86400000),
        responseDeadline: new Date(Date.now() - 15 * 86400000),
        buyerReviewDeadline: new Date(Date.now() - 5 * 86400000),
        buyerAcceptsEscalation: true, sellerAcceptsEscalation: true,
        createdAt: new Date(Date.now() - 17 * 86400000),
      },
    });
    sellerCount++;
    console.log(`  ✓ ESCALATED #${sellerCount}: DAMAGED_IN_TRANSIT by ${bot.displayName}`);
  }

  // 8-10: RESOLVED
  const sellerResolvedConfigs = [
    { status: "RESOLVED_SELLER", resolution: "NO_REFUND", reason: "NOT_RECEIVED", days: 35 },
    { status: "RESOLVED_BUYER", resolution: "REFUND_FULL", reason: "DAMAGED_IN_TRANSIT", days: 28 },
    { status: "RESOLVED_MUTUAL", resolution: "MUTUAL_AGREEMENT", reason: "NOT_AS_DESCRIBED", days: 22, partial: 30 },
  ];
  for (let i = 0; i < 3; i++) {
    const cfg = sellerResolvedConfigs[i];
    const bot = bots[(i + 1) % bots.length];
    const itemCost = 45 + i * 20;
    const bundle = await prisma.shippingBundle.create({
      data: {
        buyerId: bot.id, sellerId: atomicsnipz.id,
        status: cfg.status === "RESOLVED_BUYER" ? "CANCELLED" : "COMPLETED",
        shippingCost: 4.95, totalItemCost: itemCost, totalCost: itemCost + 4.95,
        trackingUrl: cfg.status === "RESOLVED_SELLER" ? "https://postnl.nl/tracktrace/TRES" + (i + 5) : null,
        shippedAt: new Date(Date.now() - (cfg.days + 8) * 86400000),
        deliveredAt: cfg.status !== "RESOLVED_BUYER" ? new Date(Date.now() - cfg.days * 86400000) : null,
        ...botAddrs[(i + 2) % botAddrs.length],
        createdAt: new Date(Date.now() - (cfg.days + 12) * 86400000),
      },
    });
    await prisma.dispute.create({
      data: {
        shippingBundleId: bundle.id, openedById: bot.id,
        reason: cfg.reason, description: descriptions[cfg.reason][i],
        evidenceUrls: "[]", status: cfg.status,
        resolution: cfg.resolution,
        sellerResponse: sellerResponses[i],
        sellerRespondedAt: new Date(Date.now() - (cfg.days + 2) * 86400000),
        resolvedAt: new Date(Date.now() - cfg.days * 86400000),
        responseDeadline: new Date(Date.now() - (cfg.days + 5) * 86400000),
        partialRefundAmount: cfg.partial ?? null,
        createdAt: new Date(Date.now() - (cfg.days + 4) * 86400000),
      },
    });
    sellerCount++;
    console.log(`  ✓ ${cfg.status} #${sellerCount}: ${cfg.reason} by ${bot.displayName}`);
  }

  console.log(`\n✅ Done! Created ${buyerCount} disputes as buyer + ${sellerCount} disputes as seller = ${buyerCount + sellerCount} total`);
  console.log("\nPer tab (als koper):");
  console.log("  OPEN: 3 | SELLER_RESPONDED: 3 | ESCALATED: 1 | RESOLVED: 3");
  console.log("Per tab (als verkoper):");
  console.log("  OPEN: 3 | SELLER_RESPONDED: 3 | ESCALATED: 1 | RESOLVED: 3");
  console.log("\nAdmin paneel: 2 ESCALATED geschillen te beoordelen");
}

main().catch(console.error).finally(() => prisma.$disconnect());
