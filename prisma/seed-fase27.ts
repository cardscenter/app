/**
 * Fase 27 testdata-seeder.
 *
 * Maakt rijke testdata aan om ALLE Fase-27 flows door te lopen:
 *   - Listing-statussen (DRAFT, ACTIVE, PAUSED, RESERVED, PARTIALLY_SOLD, SOLD)
 *   - allowPartialSale aan/uit
 *   - DeliveryMethod SHIP / PICKUP / BOTH
 *   - MULTI_CARD met quantity-N entries (voor de stepper-flow)
 *   - Bestaand PENDING bundle-offer in chat
 *   - Bestaand PENDING partial-sale-proposal in chat
 *   - ACCEPTED EXTERNAL pickup-bundle (testbaar via /aankopen + /verkopen)
 *
 * Idempotent: alle test-users hebben emails op @fase27.test — wordt op
 * elke run weer leeggehaald + opnieuw gevuld.
 *
 * Run: `npx tsx prisma/seed-fase27.ts`
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const TEST_DOMAIN = "@fase27.test";
const TEST_IMAGES = [
  "/images/test-images/Foto 21-01-2023 15 51 31.jpg",
  "/images/test-images/Foto 28-01-2023 13 13 59.jpg",
  "/images/test-images/Foto 02-05-2023 12 59 02.jpg",
  "/images/test-images/Foto 12-05-2023 11 31 49.jpg",
  "/images/test-images/Foto 12-05-2023 11 39 16.jpg",
  "/images/test-images/Foto 17-05-2023 10 31 58.jpg",
  "/images/test-images/Foto 27-08-2023 13 13 30.jpg",
  "/images/test-images/Foto 03-10-2023 13 51 07.jpg",
];

function imgJson(index: number, count = 1): string {
  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    urls.push(TEST_IMAGES[(index + i) % TEST_IMAGES.length]);
  }
  return JSON.stringify(urls);
}

function generateOrderNumber(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function generatePickupCode(): string {
  return Math.floor(Math.random() * 10000).toString().padStart(4, "0");
}

async function cleanupExistingTestUsers() {
  console.log("→ Removing previous Fase-27 test users + their data");
  const existing = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { id: true },
  });
  if (existing.length === 0) return;
  const ids = existing.map((u) => u.id);

  // Delete in dependency order. User heeft veel non-cascading FKs — we
  // ruimen actief op of nullifiëren waar nodig.
  await prisma.bundleProposal.deleteMany({ where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] } });
  await prisma.proposal.deleteMany({ where: { proposerId: { in: ids } } });
  await prisma.pickupSchedule.deleteMany({
    where: { shippingBundle: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] } },
  });
  await prisma.shippingBundle.deleteMany({ where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] } });
  await prisma.message.deleteMany({ where: { senderId: { in: ids } } });
  await prisma.conversationParticipant.deleteMany({ where: { userId: { in: ids } } });
  // Conversations zonder participants opruimen
  const orphanConvos = await prisma.conversation.findMany({
    where: { participants: { none: {} } },
    select: { id: true },
  });
  await prisma.conversation.deleteMany({ where: { id: { in: orphanConvos.map((c) => c.id) } } });

  // Verwijder direct user-owned data
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.transaction.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.watchlist.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.usernameHistory.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.activityLog.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.emberTransaction.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});

  // Listing-gerelateerd
  await prisma.listingCardItem.deleteMany({ where: { listing: { sellerId: { in: ids } } } }).catch(() => {});
  await prisma.listingShippingMethod.deleteMany({ where: { listing: { sellerId: { in: ids } } } }).catch(() => {});
  // Nullify buyer-references op listings van andere sellers (theoretisch)
  await prisma.listing.updateMany({ where: { buyerId: { in: ids } }, data: { buyerId: null } }).catch(() => {});
  await prisma.listing.deleteMany({ where: { sellerId: { in: ids } } });
  await prisma.sellerShippingMethod.deleteMany({ where: { sellerId: { in: ids } } });

  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function createUser(email: string, displayName: string, opts: { city?: string; country?: string; balance?: number } = {}) {
  const passwordHash = await bcrypt.hash("test1234", 10);
  return prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      firstName: displayName,
      lastName: "Test",
      street: "Teststraat",
      houseNumber: "1",
      postalCode: "1234AB",
      city: opts.city ?? "Amersfoort",
      country: opts.country ?? "NL",
      balance: opts.balance ?? 500,
      isVerified: true,
      verificationStatus: "APPROVED",
      bankTransferReference: `${displayName.toLowerCase().replace(/\s/g, "")}${Math.floor(1000000000 + Math.random() * 8999999999)}`,
      iban: "NL91ABNA0417164300",
      accountHolderName: `${displayName} Test`,
    },
  });
}

async function createShippingMethods(sellerId: string) {
  const methods = await Promise.all([
    prisma.sellerShippingMethod.create({
      data: {
        sellerId,
        carrier: "POSTNL",
        serviceName: "Brievenbuspakket",
        price: 4.45,
        countries: JSON.stringify(["NL"]),
        shippingType: "MAILBOX_PARCEL",
        isDefault: true,
        isTracked: true,
        isSigned: false,
        isActive: true,
      },
    }),
    prisma.sellerShippingMethod.create({
      data: {
        sellerId,
        carrier: "POSTNL",
        serviceName: "Pakket tot 10kg",
        price: 7.25,
        countries: JSON.stringify(["NL"]),
        shippingType: "PARCEL",
        isDefault: false,
        isTracked: true,
        isSigned: false,
        isActive: true,
      },
    }),
    prisma.sellerShippingMethod.create({
      data: {
        sellerId,
        carrier: "POSTNL",
        serviceName: "Aangetekend",
        price: 9.95,
        countries: JSON.stringify(["NL"]),
        shippingType: "PARCEL",
        isDefault: false,
        isTracked: true,
        isSigned: true,
        isActive: true,
      },
    }),
  ]);
  return methods;
}

async function createListing(opts: {
  sellerId: string;
  title: string;
  description: string;
  listingType: "SINGLE_CARD" | "MULTI_CARD" | "COLLECTION" | "SEALED_PRODUCT" | "OTHER";
  status?: string;
  price: number;
  shippingCost?: number;
  deliveryMethod?: string;
  pickupCity?: string;
  cardName?: string;
  condition?: string;
  cardItems?: Array<{ cardName: string; condition?: string; quantity?: number }>;
  estimatedCardCount?: number;
  productType?: string;
  itemCategory?: string;
  allowPartialSale?: boolean;
  stockQuantity?: number;
  imageOffset?: number;
  shippingMethodId?: string;
}) {
  const cardItemsJson = opts.cardItems ? JSON.stringify(opts.cardItems) : null;

  const listing = await prisma.listing.create({
    data: {
      title: opts.title,
      description: opts.description,
      imageUrls: imgJson(opts.imageOffset ?? 0, 3),
      listingType: opts.listingType,
      pricingType: "FIXED",
      price: opts.price,
      shippingCost: opts.shippingCost ?? 4.45,
      deliveryMethod: opts.deliveryMethod ?? "SHIP",
      pickupCity: opts.pickupCity ?? null,
      freeShipping: false,
      packageCount: 1,
      cardName: opts.cardName ?? null,
      condition: opts.condition ?? null,
      cardItems: cardItemsJson,
      estimatedCardCount: opts.estimatedCardCount ?? null,
      productType: opts.productType ?? null,
      itemCategory: opts.itemCategory ?? null,
      allowPartialSale: opts.allowPartialSale ?? false,
      stockQuantity: Math.max(1, opts.stockQuantity ?? 1),
      status: opts.status ?? "ACTIVE",
      sellerId: opts.sellerId,
    },
  });

  // Materialiseer ListingCardItem-rows voor MULTI_CARD (volgens 27.17:
  // quantity-N → N rijen van qty 1)
  if (opts.listingType === "MULTI_CARD" && opts.cardItems) {
    for (const item of opts.cardItems) {
      const qty = Math.max(1, item.quantity ?? 1);
      for (let i = 0; i < qty; i++) {
        await prisma.listingCardItem.create({
          data: {
            listingId: listing.id,
            cardName: item.cardName,
            condition: item.condition ?? null,
            quantity: 1,
            status: "AVAILABLE",
          },
        });
      }
    }
  }

  // Fase 27.23: SEALED_PRODUCT en OTHER met stockQuantity > 1 worden ook
  // gematerialiseerd in N rijen voor de direct-buy-quantity-flow.
  // cardName = listing-titel (zelfde als createListing-action).
  if ((opts.listingType === "SEALED_PRODUCT" || opts.listingType === "OTHER") && (opts.stockQuantity ?? 1) > 0) {
    const stock = Math.max(1, opts.stockQuantity ?? 1);
    for (let i = 0; i < stock; i++) {
      await prisma.listingCardItem.create({
        data: {
          listingId: listing.id,
          cardName: opts.title,
          quantity: 1,
          status: "AVAILABLE",
        },
      });
    }
  }

  // Shipping-methods koppelen (alleen SHIP / BOTH)
  if (opts.shippingMethodId && opts.deliveryMethod !== "PICKUP") {
    await prisma.listingShippingMethod.create({
      data: {
        listingId: listing.id,
        shippingMethodId: opts.shippingMethodId,
        price: opts.shippingCost ?? 4.45,
      },
    });
  }

  return listing;
}

async function main() {
  console.log("=== Fase 27 testdata seed ===");
  await cleanupExistingTestUsers();

  console.log("→ Creating test users");
  const seller = await createUser("seller" + TEST_DOMAIN, "27 Seller", { balance: 100 });
  const buyer = await createUser("buyer" + TEST_DOMAIN, "27 Buyer", { balance: 800 });
  const buyer2 = await createUser("buyer2" + TEST_DOMAIN, "27 Buyer2", { balance: 50 });

  console.log("→ Shipping methods");
  const sellerMethods = await createShippingMethods(seller.id);
  const mailboxId = sellerMethods.find((m) => m.shippingType === "MAILBOX_PARCEL")!.id;
  const parcelId = sellerMethods.find((m) => m.shippingType === "PARCEL" && !m.isSigned)!.id;
  const signedId = sellerMethods.find((m) => m.isSigned)!.id;

  console.log("→ Creating listings (alle statussen + types)");

  // 1. DRAFT — concept
  const draft = await createListing({
    sellerId: seller.id,
    title: "Concept: Mewtwo holo PSA 9",
    description: "Nog uit te werken concept met foto's en details.",
    listingType: "SINGLE_CARD",
    status: "DRAFT",
    price: 250,
    cardName: "Mewtwo Holo",
    condition: "Mint",
    imageOffset: 0,
  });

  // 2. ACTIVE SINGLE_CARD (FIXED prijs)
  const single = await createListing({
    sellerId: seller.id,
    title: "Charizard Base Set 4/102 — Lightly Played",
    description: "Klassieke Charizard uit Base Set. Lichte tikken op de hoeken, verder mooi.",
    listingType: "SINGLE_CARD",
    price: 380,
    cardName: "Charizard",
    condition: "Lightly Played",
    shippingCost: 9.95,
    shippingMethodId: signedId,
    imageOffset: 1,
  });

  // 3. MULTI_CARD met allowPartialSale — DE belangrijkste voor flow-tests
  const multiPartial = await createListing({
    sellerId: seller.id,
    title: "Pokémon set kavel — XY tijdperk (15 kaarten)",
    description: "Selectie XY-kaarten in goede tot uitstekende staat. Open voor losse aankoop.",
    listingType: "MULTI_CARD",
    price: 75,
    allowPartialSale: true,
    cardItems: [
      { cardName: "Charizard EX", condition: "Near Mint", quantity: 1 },
      { cardName: "Pikachu", condition: "Near Mint", quantity: 5 },
      { cardName: "Eevee", condition: "Lightly Played", quantity: 3 },
      { cardName: "Mewtwo EX", condition: "Near Mint", quantity: 1 },
      { cardName: "Bulbasaur", condition: "Near Mint", quantity: 5 },
    ],
    shippingMethodId: parcelId,
    shippingCost: 7.25,
    imageOffset: 2,
  });

  // 4. MULTI_CARD ZONDER partial-sale — alles-of-niets
  const multiNoPartial = await createListing({
    sellerId: seller.id,
    title: "Compleet beginnersbundel — 8 trainerkaarten",
    description: "Alleen samen verkocht; geen losse kaarten beschikbaar.",
    listingType: "MULTI_CARD",
    price: 25,
    allowPartialSale: false,
    cardItems: [
      { cardName: "Professor Oak", quantity: 1 },
      { cardName: "Bill", quantity: 2 },
      { cardName: "Energy Search", quantity: 5 },
    ],
    shippingMethodId: mailboxId,
    imageOffset: 3,
  });

  // 5. COLLECTION
  const collection = await createListing({
    sellerId: seller.id,
    title: "Verzameling van ~150 Pokémonkaarten",
    description: "Mix van commons, uncommons en een handvol holo's. Verkocht in zijn geheel.",
    listingType: "COLLECTION",
    price: 80,
    estimatedCardCount: 150,
    shippingMethodId: parcelId,
    shippingCost: 7.25,
    imageOffset: 4,
  });

  // 6. SEALED_PRODUCT
  const sealed = await createListing({
    sellerId: seller.id,
    title: "Booster Box — Sword & Shield Brilliant Stars",
    description: "Verzegelde booster box (36 packs). Direct uit case.",
    listingType: "SEALED_PRODUCT",
    price: 195,
    productType: "BOOSTER_BOX",
    shippingMethodId: signedId,
    shippingCost: 9.95,
    imageOffset: 5,
  });

  // 7. OTHER — playmat
  const other = await createListing({
    sellerId: seller.id,
    title: "Pokémon Playmat — Charizard art",
    description: "Officiële playmat 60×35cm. Nieuw in plastic.",
    listingType: "OTHER",
    price: 45,
    itemCategory: "Playmat",
    shippingMethodId: parcelId,
    shippingCost: 7.25,
    imageOffset: 6,
  });

  // 8. PAUSED listing
  const paused = await createListing({
    sellerId: seller.id,
    title: "Booster pack — Evolutions",
    description: "Tijdelijk uit verkoop.",
    listingType: "SEALED_PRODUCT",
    status: "PAUSED",
    price: 12,
    productType: "BOOSTER",
    shippingMethodId: mailboxId,
    imageOffset: 7,
  });

  // 9. PICKUP-only
  const pickupOnly = await createListing({
    sellerId: seller.id,
    title: "Verzameling — alleen ophalen Amersfoort",
    description: "Te groot om te verzenden. Alleen ophalen.",
    listingType: "COLLECTION",
    price: 120,
    deliveryMethod: "PICKUP",
    pickupCity: seller.city ?? "Amersfoort",
    estimatedCardCount: 400,
    shippingCost: 0,
    imageOffset: 0,
  });

  // 10. BOTH delivery
  const bothDelivery = await createListing({
    sellerId: seller.id,
    title: "Tin met promo's — verzenden of ophalen",
    description: "Verzenden via PostNL of zelf ophalen in Amersfoort.",
    listingType: "SEALED_PRODUCT",
    price: 35,
    productType: "TIN",
    deliveryMethod: "BOTH",
    pickupCity: seller.city ?? "Amersfoort",
    shippingMethodId: parcelId,
    shippingCost: 7.25,
    imageOffset: 1,
  });

  // 11. PARTIALLY_SOLD listing — een MULTI_CARD waar al wat verkocht is
  // We maken de listing ACTIVE en flippen handmatig 2 items naar SOLD om
  // de PARTIALLY_SOLD-flow visueel te kunnen testen. Buyer = buyer2.
  const partiallySoldListing = await createListing({
    sellerId: seller.id,
    title: "Holo-bundel — al deels verkocht",
    description: "Hieronder zie je welke al weg zijn. Vraag de overgebleven items aan via chat.",
    listingType: "MULTI_CARD",
    price: 60,
    allowPartialSale: true,
    cardItems: [
      { cardName: "Gyarados Holo", condition: "Near Mint", quantity: 2 },
      { cardName: "Magikarp", condition: "Near Mint", quantity: 3 },
      { cardName: "Lapras", condition: "Lightly Played", quantity: 1 },
    ],
    shippingMethodId: parcelId,
    shippingCost: 7.25,
    imageOffset: 2,
  });
  // Flip 2 items naar SOLD + listing-status naar PARTIALLY_SOLD
  const partialItems = await prisma.listingCardItem.findMany({
    where: { listingId: partiallySoldListing.id },
    take: 2,
  });
  for (const it of partialItems) {
    await prisma.listingCardItem.update({
      where: { id: it.id },
      data: { status: "SOLD", buyerId: buyer2.id, soldAt: new Date() },
    });
  }
  await prisma.listing.update({
    where: { id: partiallySoldListing.id },
    data: { status: "PARTIALLY_SOLD" },
  });

  // 12. SOLD listing — historie
  await createListing({
    sellerId: seller.id,
    title: "Houndour set — verkocht",
    description: "Verkocht, alleen voor history.",
    listingType: "SINGLE_CARD",
    status: "SOLD",
    price: 18,
    cardName: "Houndour",
    condition: "Near Mint",
    shippingMethodId: mailboxId,
    imageOffset: 3,
  });

  // === Stocked sealed-products (Fase 27.23) — real-world Marktplaats scenario ===
  // De seller heeft meerdere stuks van hetzelfde product. Buyer kan via
  // stepper kiezen hoeveel, "Direct kopen", betaling + escrow direct.
  console.log("→ Creating stocked listings (direct-buy quantity flow)");

  // 13. 20× Booster pack @ €9.50 — de hoofdmoot van het scenario
  const stockBoosters = await createListing({
    sellerId: seller.id,
    title: "Destined Rivals booster pack",
    description: "Verzegelde booster pack uit Destined Rivals. Voorraad: 20 stuks. Direct kopen mogelijk per stuk via de keuze-stepper.",
    listingType: "SEALED_PRODUCT",
    productType: "BOOSTER",
    price: 9.5,
    stockQuantity: 20,
    shippingMethodId: parcelId,
    shippingCost: 7.25,
    imageOffset: 5,
  });

  // 14. 9× Elite Trainer Box @ €75 — hoger bedrag, dus aangetekend verplicht (>€150 bij 3+ stuks)
  await createListing({
    sellerId: seller.id,
    title: "Perfect Order Elite Trainer Box",
    description: "Verzegelde ETB. Voorraad: 9 stuks. Bij 3+ stuks wordt aangetekend automatisch verplicht door het systeem (>€150).",
    listingType: "SEALED_PRODUCT",
    productType: "ETB",
    price: 75,
    stockQuantity: 9,
    shippingMethodId: signedId,
    shippingCost: 9.95,
    imageOffset: 1,
  });

  // 15. 2× Mini tin @ €23
  await createListing({
    sellerId: seller.id,
    title: "Ascended Heroes mini tin",
    description: "Verzegelde mini tin. Voorraad: 2 stuks.",
    listingType: "SEALED_PRODUCT",
    productType: "TIN",
    price: 23,
    stockQuantity: 2,
    shippingMethodId: parcelId,
    shippingCost: 7.25,
    imageOffset: 6,
  });

  // 16. OTHER met stock — 5× sleeves
  await createListing({
    sellerId: seller.id,
    title: "Card sleeves — Charizard art",
    description: "Pakje van 65 sleeves, voorraad: 5 pakjes.",
    listingType: "OTHER",
    itemCategory: "Sleeves",
    price: 12.5,
    stockQuantity: 5,
    shippingMethodId: mailboxId,
    shippingCost: 4.45,
    imageOffset: 7,
  });

  // 17. PARTIALLY_SOLD stocked listing — 6 van 10 al verkocht. Demo van
  // PARTIALLY_SOLD-status binnen de stocked-flow (BuyQuantityForm blijft
  // beschikbaar, maar maximaal 4 te koop).
  const stockPartiallySold = await createListing({
    sellerId: seller.id,
    title: "Brilliant Stars booster — bijna op",
    description: "Originele voorraad 10 stuks; al 6 verkocht. Nog 4 beschikbaar.",
    listingType: "SEALED_PRODUCT",
    productType: "BOOSTER",
    price: 8,
    stockQuantity: 10,
    shippingMethodId: mailboxId,
    shippingCost: 4.45,
    imageOffset: 0,
  });
  // Flip 6 rijen handmatig naar SOLD (toegekend aan buyer2 als "vorige koper")
  const soldRows = await prisma.listingCardItem.findMany({
    where: { listingId: stockPartiallySold.id, status: "AVAILABLE" },
    take: 6,
  });
  for (const r of soldRows) {
    await prisma.listingCardItem.update({
      where: { id: r.id },
      data: { status: "SOLD", buyerId: buyer2.id, soldAt: new Date() },
    });
  }
  await prisma.listing.update({
    where: { id: stockPartiallySold.id },
    data: { status: "PARTIALLY_SOLD" },
  });

  console.log("→ Creating chat with PENDING bundle-offer (buyer → seller)");
  // Conversation tussen seller en buyer voor de listings 'single' + 'multiPartial' + 'multiNoPartial'.
  const convoBundle = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: seller.id },
          { userId: buyer.id },
        ],
      },
    },
  });
  await prisma.message.create({
    data: { conversationId: convoBundle.id, senderId: buyer.id, body: "Hoi! Ik ben geïnteresseerd in een paar van je advertenties." },
  });
  await prisma.message.create({
    data: { conversationId: convoBundle.id, senderId: seller.id, body: "Hoi 27 Buyer! Welke had je in gedachten?" },
  });

  // PENDING bundle-offer (buyer biedt op 3 listings van seller)
  const bundleProposal = await prisma.bundleProposal.create({
    data: {
      conversationId: convoBundle.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 95,
      deliveryMethod: "SHIP",
      paymentMode: "PLATFORM",
      requestInsuredShipping: false,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      listings: {
        create: [
          { listingId: multiNoPartial.id, priceSnapshot: multiNoPartial.price },
          { listingId: other.id, priceSnapshot: other.price },
        ],
      },
    },
  });
  await prisma.message.create({
    data: {
      conversationId: convoBundle.id,
      senderId: buyer.id,
      body: `Bundel-voorstel: 2 advertenties voor €95.00 (verzenden)`,
      bundleProposalId: bundleProposal.id,
    },
  });

  console.log("→ Creating chat with PENDING partial-sale-proposal");
  // Tweede chat met buyer over multiPartial — buyer wil 2 items kopen
  const convoPartial = await prisma.conversation.create({
    data: {
      listingId: multiPartial.id,
      participants: {
        create: [
          { userId: seller.id },
          { userId: buyer.id },
        ],
      },
    },
  });
  await prisma.message.create({
    data: { conversationId: convoPartial.id, senderId: buyer.id, body: "Mag ik alleen de Charizard EX en 2 Pikachu's overnemen?" },
  });
  // Pak 1× Charizard EX + 2× Pikachu uit multiPartial
  const charizard = await prisma.listingCardItem.findFirst({
    where: { listingId: multiPartial.id, cardName: "Charizard EX", status: "AVAILABLE" },
  });
  const pikachus = await prisma.listingCardItem.findMany({
    where: { listingId: multiPartial.id, cardName: "Pikachu", status: "AVAILABLE" },
    take: 2,
  });
  const partialIds = [charizard!.id, ...pikachus.map((p) => p.id)];
  const partialProposal = await prisma.proposal.create({
    data: {
      conversationId: convoPartial.id,
      listingId: multiPartial.id,
      proposerId: buyer.id,
      amount: 35,
      type: "BUY",
      status: "PENDING",
      itemIds: JSON.stringify(partialIds),
      requestInsuredShipping: false,
    },
  });
  await prisma.message.create({
    data: {
      conversationId: convoPartial.id,
      senderId: buyer.id,
      body: `Gedeeltelijke verkoop: 3 item(s) voor €35.00 (incl. verzending).`,
      proposalId: partialProposal.id,
    },
  });

  console.log("→ Creating ACCEPTED EXTERNAL pickup-bundle (test code-confirm flow)");
  // Een buyer reserveert de PICKUP-only listing — bundle staat op SCHEDULED
  // met een aangemaakt pickup-moment + code zichtbaar voor buyer.
  await prisma.listing.update({
    where: { id: pickupOnly.id },
    data: { status: "RESERVED", buyerId: buyer.id },
  });
  const pickupBundle = await prisma.shippingBundle.create({
    data: {
      orderNumber: generateOrderNumber(),
      buyerId: buyer.id,
      sellerId: seller.id,
      shippingCost: 0,
      totalItemCost: pickupOnly.price ?? 120,
      totalCost: pickupOnly.price ?? 120,
      status: "SCHEDULED",
      paymentMode: "EXTERNAL",
      listingId: pickupOnly.id,
      pickupReservationExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });
  // PickupSchedule met geaccepteerd moment + code
  const pickupCode = generatePickupCode();
  await prisma.pickupSchedule.create({
    data: {
      shippingBundleId: pickupBundle.id,
      proposedById: buyer.id,
      proposedFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      windowStart: "10:00",
      windowEnd: "12:00",
      status: "ACCEPTED",
      pickupCode,
      respondedAt: new Date(),
    },
  });

  console.log("");
  console.log("========================================");
  console.log("✓ Fase-27 testdata aangemaakt");
  console.log("========================================");
  console.log("");
  console.log("Stocked listings (direct-buy met stepper, Fase 27.23):");
  console.log(`  - 20× Destined Rivals booster pack @ €9.50  ★ "${stockBoosters.title}"`);
  console.log(`  - 9× Perfect Order ETB @ €75 (aangetekend bij 3+)`);
  console.log(`  - 2× Ascended Heroes mini tin @ €23`);
  console.log(`  - 5× Card sleeves @ €12.50 (OTHER-type met stock)`);
  console.log(`  - PARTIALLY_SOLD: 4 van 10 Brilliant Stars over @ €8/stuk`);
  console.log("");
  console.log("Login (alle test-users hebben wachtwoord 'test1234'):");
  console.log(`  • seller${TEST_DOMAIN}    — verkoper, €100 saldo`);
  console.log(`  • buyer${TEST_DOMAIN}     — koper, €800 saldo (kan vol betalen)`);
  console.log(`  • buyer2${TEST_DOMAIN}    — koper, €50 saldo (test partial-balance flow)`);
  console.log("");
  console.log("Listings van 27 Seller (10 stuks, alle statussen):");
  console.log(`  - DRAFT:           "${draft.title}"`);
  console.log(`  - ACTIVE single:   "${single.title}"`);
  console.log(`  - PARTIAL ON:      "${multiPartial.title}"  ★ test gedeeltelijke verkoop`);
  console.log(`  - PARTIAL OFF:     "${multiNoPartial.title}"`);
  console.log(`  - COLLECTION:      "${collection.title}"`);
  console.log(`  - SEALED:          "${sealed.title}"`);
  console.log(`  - OTHER:           "${other.title}"`);
  console.log(`  - PAUSED:          "${paused.title}"`);
  console.log(`  - PICKUP-ONLY:     "${pickupOnly.title}"  ★ test pickup-flow (RESERVED+SCHEDULED)`);
  console.log(`  - BOTH delivery:   "${bothDelivery.title}"`);
  console.log(`  - PARTIALLY_SOLD:  "${partiallySoldListing.title}"  ★ 2 items al weg`);
  console.log("");
  console.log("Active flows in chat:");
  console.log(`  • PENDING bundle-offer  → log in als seller, ga naar /berichten`);
  console.log(`  • PENDING partial-sale  → 27 Buyer biedt 3 items uit "${multiPartial.title}"`);
  console.log("");
  console.log(`Pickup-code voor scheduled bundle: ${pickupCode}`);
  console.log(`(zichtbaar voor 27 Buyer in /dashboard/aankopen — door 27 Seller in te voeren in /dashboard/verkopen)`);
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
