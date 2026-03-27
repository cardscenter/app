import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const TEST_PASSWORD = "Test1234!";

const botUsers = [
  { displayName: "PikaFan_NL", email: "pikafan@test.nl", bio: "Pokémon verzamelaar sinds 1999. Gespecialiseerd in Base Set en Neo Era kaarten." },
  { displayName: "CharizardKing", email: "charizard@test.nl", bio: "Op zoek naar alle Charizard varianten. Heb een collectie van 200+ Charizards!" },
  { displayName: "TrainerMax", email: "max@test.nl", bio: "Casual collector, voornamelijk moderne sets. Snelle verzending!" },
  { displayName: "VintageCards_Amsterdam", email: "vintage@test.nl", bio: "Vintage kaarten specialist uit Amsterdam. Alles in Near Mint conditie." },
  { displayName: "SetCompleter", email: "sets@test.nl", bio: "Bezig met het voltooien van elke Pokémon set. Altijd op zoek naar missende kaarten." },
  { displayName: "ShinyHunter99", email: "shiny@test.nl", bio: "Full art, alt art en shiny kaarten zijn mijn passie. Eerlijke prijzen!" },
  { displayName: "TCGDeals_Rotterdam", email: "deals@test.nl", bio: "Groothandel en losse kaarten. Scherpe prijzen, professionele verpakking." },
  { displayName: "MewtwoCollector", email: "mewtwo@test.nl", bio: "Alles van Mewtwo. PSA graded en raw. DM voor wensen!" },
  { displayName: "EeveeFanatic", email: "eevee@test.nl", bio: "Eeveelutions verzamelaar. Van Jungle tot Prismatic Evolutions." },
  { displayName: "BoosterBreaker", email: "booster@test.nl", bio: "Verse pulls uit de nieuwste sets. Dagelijks nieuwe kaarten!" },
];

// Pokémon card data for realistic listings
const pokemonCards = [
  // Base Set Era
  { name: "Charizard", set: "Base Set", era: "Base Set Era" },
  { name: "Blastoise", set: "Base Set", era: "Base Set Era" },
  { name: "Venusaur", set: "Base Set", era: "Base Set Era" },
  { name: "Pikachu", set: "Base Set", era: "Base Set Era" },
  { name: "Mewtwo", set: "Base Set", era: "Base Set Era" },
  { name: "Dark Charizard", set: "Team Rocket", era: "Base Set Era" },
  { name: "Dark Blastoise", set: "Team Rocket", era: "Base Set Era" },
  { name: "Flareon", set: "Jungle", era: "Base Set Era" },
  { name: "Jolteon", set: "Jungle", era: "Base Set Era" },
  { name: "Vaporeon", set: "Jungle", era: "Base Set Era" },
  // Neo Era
  { name: "Lugia", set: "Neo Genesis", era: "Neo Era" },
  { name: "Typhlosion", set: "Neo Genesis", era: "Neo Era" },
  { name: "Shining Gyarados", set: "Neo Revelation", era: "Neo Era" },
  { name: "Shining Charizard", set: "Neo Destiny", era: "Neo Era" },
  // Modern - Sword & Shield
  { name: "Charizard VMAX", set: "Darkness Ablaze", era: "Sword & Shield Era" },
  { name: "Umbreon VMAX (Alt Art)", set: "Evolving Skies", era: "Sword & Shield Era" },
  { name: "Rayquaza VMAX (Alt Art)", set: "Evolving Skies", era: "Sword & Shield Era" },
  { name: "Moonbreon (Umbreon V Alt Art)", set: "Evolving Skies", era: "Sword & Shield Era" },
  { name: "Giratina VSTAR", set: "Lost Origin", era: "Sword & Shield Era" },
  { name: "Lugia V (Alt Art)", set: "Silver Tempest", era: "Sword & Shield Era" },
  // Modern - Scarlet & Violet
  { name: "Charizard ex (SAR)", set: "Obsidian Flames", era: "Scarlet & Violet Era" },
  { name: "Mew ex (SAR)", set: "151", era: "Scarlet & Violet Era" },
  { name: "Charizard ex (IR)", set: "151", era: "Scarlet & Violet Era" },
  { name: "Pikachu ex (SAR)", set: "Surging Sparks", era: "Scarlet & Violet Era" },
  { name: "Umbreon ex (SAR)", set: "Prismatic Evolutions", era: "Scarlet & Violet Era" },
  { name: "Eevee (IR)", set: "Prismatic Evolutions", era: "Scarlet & Violet Era" },
  { name: "Gardevoir ex (SAR)", set: "Paldea Evolved", era: "Scarlet & Violet Era" },
  { name: "Miraidon ex", set: "Scarlet & Violet", era: "Scarlet & Violet Era" },
  { name: "Koraidon ex", set: "Scarlet & Violet", era: "Scarlet & Violet Era" },
  { name: "Iono (SAR)", set: "Paldea Evolved", era: "Scarlet & Violet Era" },
];

const conditions = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrice(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function randomFutureDate(minDays: number, maxDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + minDays + Math.floor(Math.random() * (maxDays - minDays)));
  return d;
}

async function main() {
  console.log("🎴 Generating test data...\n");

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  // Get all card sets from DB
  const allSets = await prisma.cardSet.findMany({
    include: { series: true },
  });

  function findSet(setName: string, eraName: string) {
    return allSets.find((s) => s.name === setName && s.series.name === eraName);
  }

  // --- Create bot users ---
  console.log("👤 Creating bot users...");
  const users: { id: string; displayName: string }[] = [];

  for (const bot of botUsers) {
    const user = await prisma.user.upsert({
      where: { email: bot.email },
      update: {},
      create: {
        email: bot.email,
        passwordHash,
        displayName: bot.displayName,
        bio: bot.bio,
        balance: randomPrice(50, 500),
        defaultShippingCost: randomFrom([2.50, 3.50, 4.50, 5.00]),
      },
    });
    users.push({ id: user.id, displayName: user.displayName });
    console.log(`  ✓ ${bot.displayName}`);
  }

  // --- Create Auctions ---
  console.log("\n🔨 Creating auctions...");

  const auctionData = [
    {
      title: "Base Set Charizard Holo 1st Edition — Investment Grade",
      description: "Ongelooflijke kans! Base Set 1st Edition Charizard in uitstekende conditie. Geen whitening op de achterkant, holo heeft minimale scratches. Een must-have voor elke serieuze verzamelaar.\n\nKaart is opgeslagen in een toploader + sleeve sinds aankoop in 2001.",
      card: pokemonCards[0], condition: "Near Mint", startingBid: 450, reservePrice: 800, buyNowPrice: 1500, duration: 7,
    },
    {
      title: "Shining Charizard Neo Destiny — Zeldzaam!",
      description: "Prachtige Shining Charizard uit Neo Destiny. Licht gespeeld maar nog steeds in geweldige staat. Swirl in de holo!\n\nVerzending als aangetekend pakket met tracking.",
      card: pokemonCards[13], condition: "Lightly Played", startingBid: 200, reservePrice: 350, buyNowPrice: null, duration: 5,
    },
    {
      title: "Umbreon VMAX Alt Art #215 — Moonbreon",
      description: "De beroemde Moonbreon! Umbreon VMAX Alternate Art uit Evolving Skies. Fresh pull, meteen in sleeve + toploader.\n\nDe meest gewilde moderne Pokémon kaart. Pack fresh conditie.",
      card: pokemonCards[15], condition: "Near Mint", startingBid: 150, reservePrice: null, buyNowPrice: 280, duration: 3,
    },
    {
      title: "Pikachu ex SAR Surging Sparks — Nieuw!",
      description: "Special Art Rare Pikachu ex uit Surging Sparks. Prachtig artwork, direct uit een booster pack.\n\nKomt in een toploader met bubbeltjesenvelop.",
      card: pokemonCards[23], condition: "Near Mint", startingBid: 35, reservePrice: null, buyNowPrice: 65, duration: 5,
    },
    {
      title: "Mewtwo Base Set Holo — Clean Back!",
      description: "Base Set Mewtwo holo in mooie conditie. De achterkant is opvallend schoon voor een kaart van 25+ jaar oud.\n\nPerfect voor je Base Set collectie!",
      card: pokemonCards[4], condition: "Lightly Played", startingBid: 25, reservePrice: null, buyNowPrice: 50, duration: 7,
    },
    {
      title: "Charizard ex IR 151 — Illustration Rare",
      description: "Illustration Rare Charizard ex uit de 151 set. Fantastisch artwork van Mitsuhiro Arita.\n\nPack fresh, meteen gesleevd. Klaar om gegradeerd te worden!",
      card: pokemonCards[22], condition: "Near Mint", startingBid: 75, reservePrice: null, buyNowPrice: 130, duration: 3,
    },
    {
      title: "Lugia Neo Genesis Holo 1st Edition",
      description: "Neo Genesis Lugia holo, 1st Edition stempel duidelijk zichtbaar. Lichte edge wear maar de holo is krasvrij.\n\nEen klassieker die steeds zeldzamer wordt!",
      card: pokemonCards[10], condition: "Lightly Played", startingBid: 180, reservePrice: 300, buyNowPrice: null, duration: 7,
    },
    {
      title: "Rayquaza VMAX Alt Art Evolving Skies",
      description: "Rayquaza VMAX Alternate Art — een van de mooiste kaarten uit Evolving Skies. Goud op de achtergrond, prachtig in hand.\n\nNear Mint conditie, alleen uit de sleeve gehaald voor foto's.",
      card: pokemonCards[16], condition: "Near Mint", startingBid: 120, reservePrice: null, buyNowPrice: 200, duration: 5,
    },
    {
      title: "Iono SAR Paldea Evolved — Waifu Kaart",
      description: "Special Art Rare Iono uit Paldea Evolved. Een van de meest populaire trainer kaarten van dit moment!\n\nPack fresh, perfect gecentreerd.",
      card: pokemonCards[29], condition: "Near Mint", startingBid: 45, reservePrice: null, buyNowPrice: 85, duration: 3,
    },
    {
      title: "Dark Charizard Holo Team Rocket — Retro",
      description: "Dark Charizard holo uit de originele Team Rocket set. Nostalgische kaart in goede staat.\n\nKlein krasje op de holo, verder uitstekend. Zie foto's voor details.",
      card: pokemonCards[5], condition: "Moderately Played", startingBid: 35, reservePrice: null, buyNowPrice: 70, duration: 7,
    },
  ];

  for (let i = 0; i < auctionData.length; i++) {
    const a = auctionData[i];
    const seller = users[i % users.length];
    const cardSet = findSet(a.card.set, a.card.era);
    if (!cardSet) { console.log(`  ⚠ Set not found: ${a.card.set} (${a.card.era})`); continue; }

    const endTime = randomFutureDate(1, a.duration);

    await prisma.auction.create({
      data: {
        title: a.title,
        description: a.description,
        auctionType: "SINGLE_CARD",
        cardName: a.card.name,
        cardSetId: cardSet.id,
        condition: a.condition,
        sellerId: seller.id,
        startingBid: a.startingBid,
        reservePrice: a.reservePrice,
        buyNowPrice: a.buyNowPrice,
        duration: a.duration,
        endTime,
        currentBid: Math.random() > 0.4 ? randomPrice(a.startingBid, a.startingBid * 1.5) : null,
      },
    });
    console.log(`  ✓ ${a.title}`);
  }

  // --- Create Listings (Marktplaats) ---
  console.log("\n🏪 Creating marketplace listings...");

  const listingData = [
    {
      title: "Umbreon ex SAR Prismatic Evolutions",
      description: "Special Art Rare Umbreon ex uit Prismatic Evolutions. Een van de meest gewilde kaarten uit deze set!\n\nPack fresh conditie, direct in een penny sleeve en toploader gedaan. Perfecte centering.",
      card: pokemonCards[24], condition: "Near Mint", pricingType: "FIXED" as const, price: 95, shipping: 3.50,
    },
    {
      title: "Eevee IR Prismatic Evolutions — Schattig!",
      description: "Illustration Rare Eevee uit Prismatic Evolutions. Prachtig artwork, een must-have voor elke Eevee fan.\n\nVerzending in een bubbeltjesenvelop met tracking.",
      card: pokemonCards[25], condition: "Near Mint", pricingType: "FIXED" as const, price: 28, shipping: 2.50,
    },
    {
      title: "Gardevoir ex SAR Paldea Evolved",
      description: "Special Art Rare Gardevoir ex. Schitterende full art kaart met de iconische Gardevoir.\n\nNear Mint, uit mijn persoonlijke collectie.",
      card: pokemonCards[26], condition: "Near Mint", pricingType: "FIXED" as const, price: 42, shipping: 3.50,
    },
    {
      title: "Giratina VSTAR Lost Origin — Competitive Staple",
      description: "Giratina VSTAR, een van de sterkste kaarten in het huidige format. Perfect voor je competitieve deck.\n\nLightly played door toernooigebruik maar nog steeds in uitstekende conditie.",
      card: pokemonCards[18], condition: "Lightly Played", pricingType: "FIXED" as const, price: 18, shipping: 2.50,
    },
    {
      title: "Charizard VMAX Darkness Ablaze — Rainbow",
      description: "De beroemde Charizard VMAX uit Darkness Ablaze. Rainbow rare versie met prachtige kleuren.\n\nPrijs is bespreekbaar bij snelle deal!",
      card: pokemonCards[14], condition: "Near Mint", pricingType: "NEGOTIABLE" as const, price: null, shipping: 4.50,
    },
    {
      title: "Mew ex SAR 151 — Mewtube Art",
      description: "Special Art Rare Mew ex uit de 151 set. Het iconische artwork waar Mew in een glazen buis zweeft.\n\nOnberispelijke conditie, pack fresh.",
      card: pokemonCards[21], condition: "Near Mint", pricingType: "FIXED" as const, price: 55, shipping: 3.50,
    },
    {
      title: "Miraidon ex Scarlet & Violet",
      description: "Miraidon ex uit de basis Scarlet & Violet set. Goede speelkaart voor het huidige format.\n\nPrijs overeen te komen, stuur een bericht!",
      card: pokemonCards[27], condition: "Near Mint", pricingType: "NEGOTIABLE" as const, price: null, shipping: 2.50,
    },
    {
      title: "Blastoise Base Set Holo — Klassiek",
      description: "Originele Blastoise holo uit de Base Set. Een kaart die iedereen in zijn collectie wil hebben.\n\nModerately Played maar de holo is nog steeds prachtig. Eerlijke prijs voor de conditie.",
      card: pokemonCards[1], condition: "Moderately Played", pricingType: "FIXED" as const, price: 45, shipping: 4.50,
    },
    {
      title: "Lugia V Alt Art Silver Tempest",
      description: "Alternate Art Lugia V uit Silver Tempest. Prachtig artwork met Lugia die door de wolken vliegt.\n\nNear Mint, geen whitening, perfecte holo.",
      card: pokemonCards[19], condition: "Near Mint", pricingType: "FIXED" as const, price: 68, shipping: 3.50,
    },
    {
      title: "Koraidon ex Scarlet & Violet — Bulk Deal",
      description: "Koraidon ex, lekker voor in je deck of als start van je collectie.\n\nPrijs is flex, neem contact op voor een goede deal. Bij meerdere kaarten korting!",
      card: pokemonCards[28], condition: "Lightly Played", pricingType: "NEGOTIABLE" as const, price: null, shipping: 2.50,
    },
  ];

  for (let i = 0; i < listingData.length; i++) {
    const l = listingData[i];
    const seller = users[(i + 3) % users.length];
    const cardSet = findSet(l.card.set, l.card.era);
    if (!cardSet) { console.log(`  ⚠ Set not found: ${l.card.set} (${l.card.era})`); continue; }

    await prisma.listing.create({
      data: {
        title: l.title,
        description: l.description,
        cardName: l.card.name,
        cardSetId: cardSet.id,
        condition: l.condition,
        pricingType: l.pricingType,
        price: l.price,
        shippingCost: l.shipping,
        sellerId: seller.id,
      },
    });
    console.log(`  ✓ ${l.title}`);
  }

  // --- Create Claimsales ---
  console.log("\n📋 Creating claimsales...");

  const claimsaleData = [
    {
      title: "Base Set Holos Uitverkoop — Alles moet weg!",
      description: "Opruiming van mijn dubbele Base Set holos. Alle kaarten zijn in goede conditie voor hun leeftijd. Grijp je kans op deze klassiekers!",
      shipping: 5.00,
      status: "LIVE" as const,
      cards: [
        { name: "Alakazam", set: "Base Set", era: "Base Set Era", condition: "Lightly Played", price: 15 },
        { name: "Gyarados", set: "Base Set", era: "Base Set Era", condition: "Moderately Played", price: 12 },
        { name: "Nidoking", set: "Base Set", era: "Base Set Era", condition: "Lightly Played", price: 10 },
        { name: "Ninetales", set: "Base Set", era: "Base Set Era", condition: "Near Mint", price: 18 },
        { name: "Poliwrath", set: "Base Set", era: "Base Set Era", condition: "Heavily Played", price: 5 },
        { name: "Hitmonchan", set: "Base Set", era: "Base Set Era", condition: "Lightly Played", price: 8 },
      ],
    },
    {
      title: "Evolving Skies V & VMAX Collectie",
      description: "Mooie selectie kaarten uit Evolving Skies. Allemaal pack fresh, direct gesleevd. Verzameling Eeveelution V kaarten en meer!",
      shipping: 4.50,
      status: "LIVE" as const,
      cards: [
        { name: "Sylveon V", set: "Evolving Skies", era: "Sword & Shield Era", condition: "Near Mint", price: 8 },
        { name: "Glaceon V", set: "Evolving Skies", era: "Sword & Shield Era", condition: "Near Mint", price: 6 },
        { name: "Leafeon V", set: "Evolving Skies", era: "Sword & Shield Era", condition: "Near Mint", price: 5 },
        { name: "Espeon V", set: "Evolving Skies", era: "Sword & Shield Era", condition: "Near Mint", price: 7 },
        { name: "Flareon V", set: "Evolving Skies", era: "Sword & Shield Era", condition: "Near Mint", price: 5 },
        { name: "Dracozolt VMAX", set: "Evolving Skies", era: "Sword & Shield Era", condition: "Near Mint", price: 3 },
        { name: "Dragonite V", set: "Evolving Skies", era: "Sword & Shield Era", condition: "Near Mint", price: 4 },
        { name: "Rayquaza V", set: "Evolving Skies", era: "Sword & Shield Era", condition: "Near Mint", price: 12 },
      ],
    },
    {
      title: "Scarlet & Violet ex Kaarten — Verse Pulls",
      description: "Allemaal verse pulls uit verschillende Scarlet & Violet sets. Perfect voor deck builders en verzamelaars. Bij afname van 3+ kaarten gratis verzending!",
      shipping: 3.50,
      status: "LIVE" as const,
      cards: [
        { name: "Arcanine ex", set: "Obsidian Flames", era: "Scarlet & Violet Era", condition: "Near Mint", price: 4 },
        { name: "Tyranitar ex", set: "Obsidian Flames", era: "Scarlet & Violet Era", condition: "Near Mint", price: 6 },
        { name: "Groudon ex", set: "Obsidian Flames", era: "Scarlet & Violet Era", condition: "Near Mint", price: 5 },
        { name: "Alakazam ex", set: "151", era: "Scarlet & Violet Era", condition: "Near Mint", price: 8 },
        { name: "Erika's Invitation", set: "151", era: "Scarlet & Violet Era", condition: "Near Mint", price: 22 },
        { name: "Walking Wake ex", set: "Temporal Forces", era: "Scarlet & Violet Era", condition: "Near Mint", price: 5 },
        { name: "Iron Leaves ex", set: "Temporal Forces", era: "Scarlet & Violet Era", condition: "Near Mint", price: 4 },
      ],
    },
    {
      title: "Neo Era Lot — Nostalgie!",
      description: "Set van Neo Era kaarten. Prachtige holo's uit een tijdperk dat steeds populairder wordt bij verzamelaars.",
      shipping: 5.00,
      status: "LIVE" as const,
      cards: [
        { name: "Togetic", set: "Neo Genesis", era: "Neo Era", condition: "Lightly Played", price: 8 },
        { name: "Pichu", set: "Neo Genesis", era: "Neo Era", condition: "Near Mint", price: 12 },
        { name: "Steelix", set: "Neo Genesis", era: "Neo Era", condition: "Moderately Played", price: 6 },
        { name: "Espeon", set: "Neo Discovery", era: "Neo Era", condition: "Lightly Played", price: 25 },
        { name: "Umbreon", set: "Neo Discovery", era: "Neo Era", condition: "Lightly Played", price: 35 },
      ],
    },
    {
      title: "Prismatic Evolutions Pulls — Eevee Feest!",
      description: "Diverse kaarten uit de nieuwste Prismatic Evolutions set. Alle Eeveelutions vertegenwoordigd! Pack fresh, allemaal Near Mint.",
      shipping: 3.50,
      status: "LIVE" as const,
      cards: [
        { name: "Vaporeon ex", set: "Prismatic Evolutions", era: "Scarlet & Violet Era", condition: "Near Mint", price: 6 },
        { name: "Jolteon ex", set: "Prismatic Evolutions", era: "Scarlet & Violet Era", condition: "Near Mint", price: 5 },
        { name: "Flareon ex", set: "Prismatic Evolutions", era: "Scarlet & Violet Era", condition: "Near Mint", price: 5 },
        { name: "Espeon ex", set: "Prismatic Evolutions", era: "Scarlet & Violet Era", condition: "Near Mint", price: 7 },
        { name: "Glaceon ex", set: "Prismatic Evolutions", era: "Scarlet & Violet Era", condition: "Near Mint", price: 6 },
        { name: "Leafeon ex", set: "Prismatic Evolutions", era: "Scarlet & Violet Era", condition: "Near Mint", price: 5 },
        { name: "Sylveon ex", set: "Prismatic Evolutions", era: "Scarlet & Violet Era", condition: "Near Mint", price: 8 },
        { name: "Umbreon ex", set: "Prismatic Evolutions", era: "Scarlet & Violet Era", condition: "Near Mint", price: 15 },
        { name: "Eevee (Holo)", set: "Prismatic Evolutions", era: "Scarlet & Violet Era", condition: "Near Mint", price: 3 },
      ],
    },
    {
      title: "Sword & Shield Trainer Gallery",
      description: "Trainer Gallery kaarten uit diverse Sword & Shield sets. Character rares en trainer gallery kaarten — prachtige artworks!",
      shipping: 3.50,
      status: "LIVE" as const,
      cards: [
        { name: "Pikachu TG", set: "Crown Zenith", era: "Sword & Shield Era", condition: "Near Mint", price: 10 },
        { name: "Charizard TG", set: "Crown Zenith", era: "Sword & Shield Era", condition: "Near Mint", price: 18 },
        { name: "Mimikyu TG", set: "Crown Zenith", era: "Sword & Shield Era", condition: "Near Mint", price: 5 },
        { name: "Sylveon TG", set: "Brilliant Stars", era: "Sword & Shield Era", condition: "Near Mint", price: 6 },
        { name: "Umbreon TG", set: "Brilliant Stars", era: "Sword & Shield Era", condition: "Near Mint", price: 12 },
      ],
    },
    {
      title: "Budget Lot — Starter Collectie",
      description: "Perfecte starterset voor nieuwe verzamelaars! Mix van holos, reverse holos en rares uit verschillende sets. Ideaal cadeau!",
      shipping: 4.00,
      status: "LIVE" as const,
      cards: [
        { name: "Pikachu V", set: "Vivid Voltage", era: "Sword & Shield Era", condition: "Near Mint", price: 3 },
        { name: "Charizard (Reverse)", set: "Vivid Voltage", era: "Sword & Shield Era", condition: "Near Mint", price: 5 },
        { name: "Snorlax (Holo)", set: "Vivid Voltage", era: "Sword & Shield Era", condition: "Near Mint", price: 2 },
        { name: "Zarude V", set: "Vivid Voltage", era: "Sword & Shield Era", condition: "Near Mint", price: 2 },
        { name: "Togekiss VMAX", set: "Vivid Voltage", era: "Sword & Shield Era", condition: "Near Mint", price: 3 },
      ],
    },
    {
      title: "Team Rocket Holo Set — Donkere Kaarten",
      description: "Verzameling Dark holo kaarten uit de originele Team Rocket set. Alle kaarten zijn LP-NM. Prachtige donkere artwork die je nergens anders vindt!",
      shipping: 5.00,
      status: "LIVE" as const,
      cards: [
        { name: "Dark Arbok", set: "Team Rocket", era: "Base Set Era", condition: "Lightly Played", price: 8 },
        { name: "Dark Dragonite", set: "Team Rocket", era: "Base Set Era", condition: "Near Mint", price: 22 },
        { name: "Dark Dugtrio", set: "Team Rocket", era: "Base Set Era", condition: "Lightly Played", price: 6 },
        { name: "Dark Golbat", set: "Team Rocket", era: "Base Set Era", condition: "Near Mint", price: 5 },
        { name: "Dark Gyarados", set: "Team Rocket", era: "Base Set Era", condition: "Moderately Played", price: 7 },
        { name: "Dark Hypno", set: "Team Rocket", era: "Base Set Era", condition: "Lightly Played", price: 5 },
        { name: "Dark Machamp", set: "Team Rocket", era: "Base Set Era", condition: "Near Mint", price: 8 },
        { name: "Dark Magneton", set: "Team Rocket", era: "Base Set Era", condition: "Lightly Played", price: 5 },
        { name: "Dark Slowbro", set: "Team Rocket", era: "Base Set Era", condition: "Near Mint", price: 6 },
        { name: "Dark Vileplume", set: "Team Rocket", era: "Base Set Era", condition: "Lightly Played", price: 5 },
      ],
    },
    {
      title: "151 Set Highlights — Kanto Nostalgie",
      description: "Mooie selectie uit de populaire 151 set. Van Bulbasaur tot Mew, originele 151 Pokémon in moderne stijl!",
      shipping: 3.50,
      status: "LIVE" as const,
      cards: [
        { name: "Bulbasaur (IR)", set: "151", era: "Scarlet & Violet Era", condition: "Near Mint", price: 8 },
        { name: "Venusaur ex", set: "151", era: "Scarlet & Violet Era", condition: "Near Mint", price: 5 },
        { name: "Blastoise ex", set: "151", era: "Scarlet & Violet Era", condition: "Near Mint", price: 6 },
        { name: "Gengar ex", set: "151", era: "Scarlet & Violet Era", condition: "Near Mint", price: 7 },
        { name: "Dragonite ex", set: "151", era: "Scarlet & Violet Era", condition: "Near Mint", price: 5 },
        { name: "Zapdos ex", set: "151", era: "Scarlet & Violet Era", condition: "Near Mint", price: 4 },
      ],
    },
    {
      title: "XY Evolutions Lot — Retro Reprint",
      description: "Kaarten uit XY Evolutions, de reprint van de originele Base Set. Goedkopere alternatief voor originele Base Set holos!",
      shipping: 3.50,
      status: "LIVE" as const,
      cards: [
        { name: "Charizard (Holo)", set: "Evolutions", era: "XY Era", condition: "Near Mint", price: 35 },
        { name: "Blastoise (Holo)", set: "Evolutions", era: "XY Era", condition: "Near Mint", price: 12 },
        { name: "Venusaur (Holo)", set: "Evolutions", era: "XY Era", condition: "Near Mint", price: 10 },
        { name: "Mewtwo EX", set: "Evolutions", era: "XY Era", condition: "Near Mint", price: 8 },
        { name: "Dragonite EX", set: "Evolutions", era: "XY Era", condition: "Lightly Played", price: 5 },
      ],
    },
  ];

  for (let i = 0; i < claimsaleData.length; i++) {
    const cs = claimsaleData[i];
    const seller = users[(i + 5) % users.length];

    const items = cs.cards
      .map((card) => {
        const cardSet = findSet(card.set, card.era);
        if (!cardSet) { console.log(`  ⚠ Set not found: ${card.set} (${card.era})`); return null; }
        return {
          cardName: card.name,
          cardSetId: cardSet.id,
          condition: card.condition,
          price: card.price,
        };
      })
      .filter(Boolean) as { cardName: string; cardSetId: string; condition: string; price: number }[];

    if (items.length === 0) continue;

    await prisma.claimsale.create({
      data: {
        title: cs.title,
        description: cs.description,
        shippingCost: cs.shipping,
        status: cs.status,
        publishedAt: cs.status === "LIVE" ? new Date() : null,
        sellerId: seller.id,
        items: { create: items },
      },
    });
    console.log(`  ✓ ${cs.title} (${items.length} kaarten)`);
  }

  // --- Add some bids to auctions ---
  console.log("\n💰 Adding bids to auctions...");
  const auctions = await prisma.auction.findMany({ where: { status: "ACTIVE" } });

  for (const auction of auctions) {
    const bidCount = Math.floor(Math.random() * 5);
    let currentBid = auction.startingBid;

    for (let b = 0; b < bidCount; b++) {
      const bidder = randomFrom(users.filter((u) => u.id !== auction.sellerId));
      currentBid = currentBid + randomPrice(1, currentBid * 0.15);

      await prisma.auctionBid.create({
        data: {
          auctionId: auction.id,
          bidderId: bidder.id,
          amount: Math.round(currentBid * 100) / 100,
          createdAt: new Date(Date.now() - Math.random() * 86400000 * 3),
        },
      });
    }

    if (bidCount > 0) {
      await prisma.auction.update({
        where: { id: auction.id },
        data: { currentBid: Math.round(currentBid * 100) / 100 },
      });
      console.log(`  ✓ ${auction.title}: ${bidCount} biedingen`);
    }
  }

  console.log("\n✅ Test data generation complete!");
  console.log(`\n📊 Summary:`);
  console.log(`  👤 ${users.length} bot users (password: ${TEST_PASSWORD})`);
  console.log(`  🔨 ${auctionData.length} auctions`);
  console.log(`  🏪 ${listingData.length} marketplace listings`);
  console.log(`  📋 ${claimsaleData.length} claimsales`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
