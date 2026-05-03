/**
 * Seed-script voor extra test-data: veilingen (met biedingen), claimsales en
 * marktplaats-listings. Voegt iedere run NIEUWE data toe — niet idempotent.
 *
 * Run: `npx tsx prisma/seed-more-testdata.ts`
 *
 * Verwacht: bestaande users + cards + cardSets in de DB (van seed.ts).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import fs from "node:fs";
import path from "node:path";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

// ---------- Helpers ----------
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}
function chance(p: number): boolean {
  return Math.random() < p;
}
function priceRange(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}
function intRange(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function futureDate(minDays: number, maxDays: number): Date {
  const d = new Date();
  d.setTime(d.getTime() + (minDays + Math.random() * (maxDays - minDays)) * 86400000);
  return d;
}

// ---------- Statics ----------
const CONDITIONS = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Excellent", "Good"];
const NL_CITIES = ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda", "Nijmegen", "Haarlem", "Arnhem", "Apeldoorn", "Enschede"];
const PACKAGE_SIZES = ["LETTER", "SMALL", "MEDIUM", "LARGE"] as const;

const SEALED_TYPES = ["BOOSTER", "ETB", "TIN", "BOOSTER_BOX", "OTHER_SEALED"] as const;
const SEALED_TITLES: Record<typeof SEALED_TYPES[number], string[]> = {
  BOOSTER: ["Booster Pack", "Pack — verzegeld", "Single Booster"],
  ETB: ["Elite Trainer Box (ETB)", "ETB sealed", "Premium ETB"],
  TIN: ["Tin sealed", "Premium Tin", "Collectie Tin"],
  BOOSTER_BOX: ["Booster Box (36 packs)", "Sealed Booster Box", "Display Box"],
  OTHER_SEALED: ["Premium Collection Box", "Special Collection", "Build & Battle Box"],
};

const OTHER_CATEGORIES = ["Toploaders", "Sleeves", "Binder", "Playmat", "Deck Box", "Card Sorter", "Display Case", "Storage Box"];

// ---------- Image-pool: random files uit /public/uploads ----------
function loadImagePool(): string[] {
  const dir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .map((f) => `/api/uploads/${f}`);
}

function randomImageSet(pool: string[], min = 1, max = 4): string {
  if (pool.length === 0) return "[]";
  const count = intRange(min, Math.min(max, pool.length));
  return JSON.stringify(pickN(pool, count));
}

// ---------- Hoofdscript ----------
async function main() {
  console.log("🎴 Genereer extra test-data...\n");

  // Kandidaten (uitsluitend echte non-admin gebruikers)
  const allUsers = await prisma.user.findMany({
    where: { accountType: { not: "ADMIN" } },
    select: { id: true, displayName: true, city: true },
  });
  if (allUsers.length < 3) {
    throw new Error("Te weinig users — run eerst prisma/seed.ts en seed-testdata.ts");
  }
  console.log(`👤 ${allUsers.length} users beschikbaar`);

  // Vul ontbrekende city aan voor users — anders kunnen pickup-listings geen
  // pickupCity meekrijgen. Voor variatie krijgt elke user een random NL stad.
  for (const u of allUsers) {
    if (!u.city) {
      const city = pick(NL_CITIES);
      await prisma.user.update({ where: { id: u.id }, data: { city } });
      u.city = city;
      console.log(`  ✓ ${u.displayName} → ${city}`);
    }
  }

  // Card-pool: pak 200 willekeurige zeldzame kaarten met een setId
  const cardPool = await prisma.card.findMany({
    where: {
      cardSetId: { not: undefined },
      rarity: { in: ["Rare", "Rare Holo", "Rare Holo EX", "Rare Holo GX", "Rare Holo VMAX", "Rare Ultra", "Rare Secret", "Special Illustration Rare", "Illustration Rare", "Hyper Rare", "Promo"] },
    },
    take: 300,
    select: { id: true, name: true, cardSetId: true },
  });
  console.log(`🃏 ${cardPool.length} cards in pool`);
  if (cardPool.length < 50) {
    // Fallback: pak gewoon de eerste 200 cards ongeacht rarity
    const fallback = await prisma.card.findMany({
      take: 200,
      select: { id: true, name: true, cardSetId: true },
    });
    cardPool.push(...fallback);
    console.log(`  ↪ fallback uitgebreid naar ${cardPool.length}`);
  }

  // CardSet-pool voor types die een set nodig hebben (SEALED_PRODUCT)
  const setPool = await prisma.cardSet.findMany({ select: { id: true, name: true } });

  // Image-pool laden
  const imagePool = loadImagePool();
  console.log(`🖼  ${imagePool.length} uploads in image-pool\n`);

  // ============================================================
  // === VEILINGEN ===
  // ============================================================
  console.log("🔨 Veilingen aanmaken...");

  const auctionTitles = {
    SINGLE_CARD: [
      "Pack-fresh — direct gesleeved",
      "Vintage holo — krasvrij",
      "PSA-ready conditie",
      "Alt Art zeldzaam",
      "Centering perfect",
      "Voor de echte verzamelaar",
      "Mijn pride collectie kaart",
      "Investment grade",
    ],
    MULTI_CARD: [
      "Lot van 5 zeldzame kaarten",
      "Set holo's uit één pull",
      "Bundel — alleen samen",
      "Mix lot premium kaarten",
      "Verzameling met thema",
    ],
    COLLECTION: [
      "Volledige collectie — opruiming",
      "Binder vol — 200+ kaarten",
      "Mijn jeugd-collectie",
      "Master collection",
      "Bulk lot — alles erop",
    ],
    SEALED_PRODUCT: [
      "Booster Box — sealed",
      "ETB Sealed — direct uit doos",
      "Premium Collection",
      "Tin Sealed",
      "Mystery Box bundel",
    ],
    OTHER: [
      "Pokémon storage bundle",
      "Verzamel-accessoires bundle",
      "Premium binder + sleeves",
    ],
  };

  let auctionsCreated = 0;
  for (let i = 0; i < 35; i++) {
    const auctionType = pick(["SINGLE_CARD", "SINGLE_CARD", "SINGLE_CARD", "MULTI_CARD", "COLLECTION", "SEALED_PRODUCT", "OTHER"] as const);
    const seller = pick(allUsers);
    const title = `${pick(auctionTitles[auctionType])} ${i + 1}`;
    const duration = pick([3, 5, 7, 14] as const);
    const startingBid = priceRange(5, 250);
    const buyNowPrice = chance(0.4) ? Math.round(startingBid * priceRange(2, 4) * 100) / 100 : null;
    const reservePrice = chance(0.3) && buyNowPrice ? Math.round(buyNowPrice * 0.6 * 100) / 100 : null;

    // Sommige veilingen "bijna afgelopen" voor urgent-feel (10% kans),
    // anders verspreid over de duration.
    const endTime = chance(0.1)
      ? futureDate(0.05, 0.5) // < 12u te gaan
      : futureDate(0.5, duration);

    // Type-specifieke velden
    let cardName: string | null = null;
    let cardSetId: string | null = null;
    let cardItems: string | null = null;
    let estimatedCardCount: number | null = null;
    let conditionRange: string | null = null;
    let productType: string | null = null;
    let itemCategory: string | null = null;
    let condition: string | null = null;
    let description = "";

    if (auctionType === "SINGLE_CARD") {
      const card = pick(cardPool);
      cardName = card.name;
      cardSetId = card.cardSetId;
      condition = pick(CONDITIONS);
      description = `${card.name} — ${condition}. Pack-fresh / direct in een toploader na pull. Kaart wordt verzonden in een sleeve + toploader binnen een bubbeltjesenvelop met tracking.`;
    } else if (auctionType === "MULTI_CARD") {
      const cards = pickN(cardPool, intRange(3, 8));
      cardItems = JSON.stringify(
        cards.map((c) => ({
          cardName: c.name,
          cardSetId: c.cardSetId,
          tcgdexId: c.id,
          condition: pick(CONDITIONS),
          quantity: 1,
        }))
      );
      description = `Bundel van ${cards.length} kaarten in goede staat. Alle kaarten worden samen verstuurd in een stevige verpakking.`;
    } else if (auctionType === "COLLECTION") {
      estimatedCardCount = intRange(50, 800);
      conditionRange = `${pick(["Near Mint", "Lightly Played", "Moderately Played"])} – ${pick(["Lightly Played", "Moderately Played", "Heavily Played"])}`;
      description = `Verzameling van ongeveer ${estimatedCardCount} kaarten in conditie ${conditionRange}. Ideaal voor verzamelaars of als startpunt.`;
    } else if (auctionType === "SEALED_PRODUCT") {
      productType = pick(SEALED_TYPES);
      const setName = pick(setPool).name;
      cardSetId = setPool.find((s) => s.name === setName)?.id ?? null;
      description = `${pick(SEALED_TITLES[productType as keyof typeof SEALED_TITLES])} van set ${setName}. 100% sealed, ongeopend. Verzending in stevige doos.`;
    } else {
      itemCategory = pick(OTHER_CATEGORIES);
      description = `${itemCategory} — gebruikt maar in goede staat. Verstuur ik in een veilige verpakking.`;
    }

    const created = await prisma.auction.create({
      data: {
        title,
        description,
        auctionType,
        cardName,
        cardSetId,
        cardItems,
        estimatedCardCount,
        conditionRange,
        productType,
        itemCategory,
        condition,
        imageUrls: randomImageSet(imagePool, 1, 4),
        startingBid,
        reservePrice,
        buyNowPrice,
        currentBid: null, // Wordt zo dadelijk geset via biedingen
        duration,
        endTime,
        sellerId: seller.id,
        status: "ACTIVE",
      },
    });
    auctionsCreated++;

    // ---------- Biedingen genereren ----------
    // 70% van de veilingen krijgt 1-8 biedingen, 30% blijft zonder bod.
    if (!chance(0.3)) {
      const bidCount = intRange(1, 8);
      const bidders = allUsers.filter((u) => u.id !== seller.id);
      let lastBid = startingBid;

      // Spreid biedingen over de afgelopen 0-72u
      for (let b = 0; b < bidCount; b++) {
        const bidder = pick(bidders);
        // Realistische incrementen: tussen 5% en 25% omhoog
        const increment = lastBid * priceRange(0.05, 0.25);
        lastBid = Math.round((lastBid + Math.max(1, increment)) * 100) / 100;

        // Stop als we de buyNowPrice naderen (75% rule)
        if (buyNowPrice && lastBid >= buyNowPrice * 0.75) break;

        await prisma.auctionBid.create({
          data: {
            auctionId: created.id,
            bidderId: bidder.id,
            amount: lastBid,
            createdAt: new Date(Date.now() - Math.random() * 86400000 * 3),
          },
        });
      }

      await prisma.auction.update({
        where: { id: created.id },
        data: { currentBid: lastBid },
      });
    }
  }
  console.log(`  ✓ ${auctionsCreated} veilingen aangemaakt (met biedingen)\n`);

  // ============================================================
  // === LISTINGS (Marktplaats) ===
  // ============================================================
  console.log("🏪 Listings aanmaken...");

  const listingTitles = {
    SINGLE_CARD: [
      "Mooie kaart — direct te verzenden",
      "Pack-fresh kaart, perfecte centering",
      "Vintage holo in goede staat",
      "Special Art Rare — uit eigen pull",
      "Trainer kaart zeldzaam",
      "Pokémon ex — top conditie",
    ],
    MULTI_CARD: [
      "Bundel zeldzame kaarten",
      "Mix lot — losse kaarten te bestellen",
      "Pokémon kaarten lot",
      "Set holo's per stuk",
    ],
    COLLECTION: [
      "Mijn collectie — alles bij elkaar",
      "Verzameling kaarten",
      "Binder vol — 100+ kaarten",
      "Lot kaarten van vroeger",
    ],
    SEALED_PRODUCT: [
      "Booster Pack sealed",
      "ETB nieuw in plastic",
      "Tin verzegeld",
      "Premium Collection box",
      "Booster Display sealed",
    ],
    OTHER: [
      "Toploaders 100 stuks",
      "Premium sleeves bundel",
      "Card binder XL",
      "Pokémon playmat",
      "Card sorting tray",
    ],
  };

  let listingsCreated = 0;
  for (let i = 0; i < 30; i++) {
    const listingType = pick(["SINGLE_CARD", "SINGLE_CARD", "SINGLE_CARD", "MULTI_CARD", "COLLECTION", "SEALED_PRODUCT", "SEALED_PRODUCT", "OTHER"] as const);
    const seller = pick(allUsers);
    const title = `${pick(listingTitles[listingType])} ${i + 1}`;

    // Pricing-strategie
    const pricingType = chance(0.65) ? "FIXED" : "NEGOTIABLE";
    const basePrice = priceRange(5, 200);
    const price = pricingType === "FIXED" ? basePrice : null;
    const suggestedPrice = pricingType === "NEGOTIABLE" && chance(0.6) ? basePrice : null;

    // Buy-options (alleen relevant voor FIXED)
    const allowDirectBuy = pricingType === "FIXED" ? chance(0.85) : true;
    const acceptsOffers = pricingType === "FIXED" ? chance(0.6) : true;

    // Delivery + pickup
    const deliveryMethod = pick(["SHIP", "SHIP", "SHIP", "PICKUP", "BOTH", "BOTH"] as const);
    const isPickupMode = deliveryMethod === "PICKUP" || deliveryMethod === "BOTH";
    const pickupCity = isPickupMode ? seller.city : null;
    const allowPlatformPickup = !isPickupMode || chance(0.5);
    const allowExternalPickup = !isPickupMode || chance(0.85);
    // Garandeer minstens één van de twee aan
    const finalPlatform = isPickupMode && !allowPlatformPickup && !allowExternalPickup ? true : allowPlatformPickup;

    // Shipping
    const freeShipping = chance(0.2);
    const shippingCost = freeShipping ? 0 : priceRange(2.5, 6.95);
    const packageSize = pick(PACKAGE_SIZES);
    const packageCount = listingType === "COLLECTION" || listingType === "MULTI_CARD" ? intRange(1, 3) : 1;

    // Type-specifieke velden
    let cardName: string | null = null;
    let cardSetId: string | null = null;
    let cardItems: string | null = null;
    let estimatedCardCount: number | null = null;
    let conditionRange: string | null = null;
    let productType: string | null = null;
    let itemCategory: string | null = null;
    let condition: string | null = null;
    let stockQuantity = 1;
    let allowPartialSale = false;
    let description = "";

    if (listingType === "SINGLE_CARD") {
      const card = pick(cardPool);
      cardName = card.name;
      cardSetId = card.cardSetId;
      condition = pick(CONDITIONS);
      description = `${card.name} in ${condition} conditie. Wordt verzonden in penny sleeve + toploader. Verzending binnen 1 werkdag na betaling.`;
    } else if (listingType === "MULTI_CARD") {
      const cards = pickN(cardPool, intRange(3, 10));
      cardItems = JSON.stringify(
        cards.map((c) => ({
          cardName: c.name,
          cardSetId: c.cardSetId,
          tcgdexId: c.id,
          condition: pick(CONDITIONS),
          quantity: 1,
        }))
      );
      allowPartialSale = chance(0.5);
      description = `Bundel van ${cards.length} kaarten. ${allowPartialSale ? "Losse kaarten zijn ook bestelbaar." : "Alleen als hele set te koop."} Allemaal in penny sleeves verzonden.`;
    } else if (listingType === "COLLECTION") {
      estimatedCardCount = intRange(50, 1500);
      conditionRange = `${pick(["Near Mint", "Lightly Played"])} – ${pick(["Lightly Played", "Moderately Played", "Heavily Played"])}`;
      description = `Mooie verzameling van ongeveer ${estimatedCardCount} kaarten in conditie ${conditionRange}. Mix van rares, holos en commons.`;
    } else if (listingType === "SEALED_PRODUCT") {
      productType = pick(SEALED_TYPES);
      const setName = pick(setPool).name;
      cardSetId = setPool.find((s) => s.name === setName)?.id ?? null;
      stockQuantity = intRange(1, 8);
      description = `${pick(SEALED_TITLES[productType as keyof typeof SEALED_TITLES])} van set ${setName}. 100% sealed, ongeopend. ${stockQuantity > 1 ? `Voorraad: ${stockQuantity} stuks.` : ""} Verzending in stevige doos met fragile-sticker.`;
    } else {
      itemCategory = pick(OTHER_CATEGORIES);
      stockQuantity = intRange(1, 12);
      description = `${itemCategory} voor je verzameling. ${stockQuantity > 1 ? `Op voorraad: ${stockQuantity} stuks.` : "1 stuks beschikbaar."} Goede staat.`;
    }

    const listing = await prisma.listing.create({
      data: {
        listingType,
        title,
        description,
        imageUrls: randomImageSet(imagePool, 1, 4),
        cardName,
        cardSetId,
        cardItems,
        estimatedCardCount,
        conditionRange,
        productType,
        itemCategory,
        condition,
        stockQuantity,
        allowPartialSale,
        pricingType,
        price,
        suggestedPrice,
        allowDirectBuy,
        acceptsOffers,
        deliveryMethod,
        freeShipping,
        shippingCost,
        packageSize,
        packageCount,
        pickupCity,
        allowPlatformPickup: finalPlatform,
        allowExternalPickup,
        sellerId: seller.id,
        status: "ACTIVE",
      },
    });

    // Materialiseer ListingCardItem-rijen voor MULTI_CARD / SEALED / OTHER
    // (Fase 27.13/27.23) zodat de listing daadwerkelijk koopbaar is.
    if (listingType === "MULTI_CARD" && cardItems) {
      try {
        const items: Array<{ cardName: string; cardSetId?: string; tcgdexId?: string; condition?: string; quantity?: number }> = JSON.parse(cardItems);
        for (const item of items) {
          if (!item.cardName) continue;
          const qty = Math.max(1, item.quantity ?? 1);
          for (let q = 0; q < qty; q++) {
            await prisma.listingCardItem.create({
              data: {
                listingId: listing.id,
                cardName: item.cardName,
                cardSetId: item.cardSetId ?? null,
                tcgdexId: item.tcgdexId ?? null,
                condition: item.condition ?? null,
                quantity: 1,
                status: "AVAILABLE",
              },
            });
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    if (listingType === "SEALED_PRODUCT" || listingType === "OTHER") {
      for (let q = 0; q < stockQuantity; q++) {
        await prisma.listingCardItem.create({
          data: {
            listingId: listing.id,
            cardName: title,
            quantity: 1,
            status: "AVAILABLE",
          },
        });
      }
    }

    listingsCreated++;
  }
  console.log(`  ✓ ${listingsCreated} listings aangemaakt\n`);

  // ============================================================
  // === CLAIMSALES ===
  // ============================================================
  console.log("📋 Claimsales aanmaken...");

  const claimsaleThemes = [
    { title: "Mega holo opruiming", desc: "Allemaal holo's uit mijn dubbele pile. Kies wat je wilt!" },
    { title: "Vintage uit de doos", desc: "Kaarten van de zolder gehaald. Mix van condities — zie elke kaart afzonderlijk." },
    { title: "Booster pulls van afgelopen maand", desc: "Verse pulls uit recente sets. Allemaal pack-fresh." },
    { title: "Trainer Gallery selectie", desc: "Trainer Gallery character rares — prachtige artworks." },
    { title: "ex-kaarten budget lot", desc: "Diverse ex-kaarten voor deck builders. Goede prijzen!" },
    { title: "Eeveelutions per stuk", desc: "Selectie Eeveelutions uit verschillende sets." },
    { title: "Reverse holos goedkoop", desc: "Reverse holos voor weinig — ideaal voor playsets." },
    { title: "Promo kaarten verzameling", desc: "Diverse promo's, sommige zeldzaam!" },
    { title: "Sword & Shield V's en VMAX'en", desc: "V en VMAX kaarten uit Sword & Shield era." },
    { title: "Scarlet & Violet ex selectie", desc: "Mix van Scarlet & Violet ex-kaarten." },
    { title: "Japanse kaarten — losse stuks", desc: "Japanse pulls die ik niet bewaar. Zeldzame stuks!" },
    { title: "151 set highlights", desc: "Mooie kaarten uit de populaire 151 set." },
    { title: "Prismatic Evolutions per stuk", desc: "Diverse pulls uit Prismatic Evolutions." },
    { title: "Holo kaarten Base Set Era", desc: "Vintage holo's uit Base Set, Jungle, Fossil." },
    { title: "Modern competitive staples", desc: "Top kaarten voor competitive play." },
    { title: "Mooie binnenkomers — verkoop", desc: "Recente pulls die ik te dubbel heb." },
    { title: "Mystery Box leftovers", desc: "Wat ik over heb van mystery boxes." },
    { title: "Pokémon TCG Pocket — fysiek", desc: "Fysieke versies van Pocket-cards." },
  ];

  let claimsalesCreated = 0;
  for (let i = 0; i < claimsaleThemes.length; i++) {
    const theme = claimsaleThemes[i];
    const seller = pick(allUsers);
    const itemCount = intRange(5, 15);
    const cards = pickN(cardPool, itemCount);

    const items = cards.map((c) => ({
      cardName: c.name,
      cardSetId: c.cardSetId,
      tcgdexId: c.id,
      condition: pick(CONDITIONS),
      price: priceRange(2, 80),
      imageUrls: randomImageSet(imagePool, 1, 2),
    }));

    await prisma.claimsale.create({
      data: {
        title: `${theme.title} — ${i + 1}`,
        description: theme.desc,
        shippingCost: priceRange(2.95, 6.50),
        status: "LIVE",
        publishedAt: new Date(),
        sellerId: seller.id,
        items: { create: items },
      },
    });
    claimsalesCreated++;
  }
  console.log(`  ✓ ${claimsalesCreated} claimsales aangemaakt\n`);

  // ---------- Samenvatting ----------
  console.log("✅ Klaar!\n");
  console.log("📊 Samenvatting:");
  console.log(`   🔨 ${auctionsCreated} veilingen (mix van types, met biedingen)`);
  console.log(`   🏪 ${listingsCreated} listings (alle 5 types, mix van delivery/pricing)`);
  console.log(`   📋 ${claimsalesCreated} claimsales (5-15 items elk)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
