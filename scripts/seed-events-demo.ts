// Seedt een set realistische demo-events voor de DEV-database — alle velden
// gevuld (tickets/VT/standhouders/faciliteiten/media/socials/toernooi) plus
// RSVP's en standhouder-aanvragen van verschillende gebruikers.
//
// Gebruik:  npx tsx scripts/seed-events-demo.ts
// Idempotent: vaste id's + upsert — meerdere keren draaien is veilig.
// NIET voor productie bedoeld (beelden komen van picsum.photos).
import { prisma } from "../src/lib/prisma";

// Wandklok Europe/Amsterdam (CEST, zomer) → UTC = -2u.
function nl(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+02:00`);
}

const img = {
  banner: (seed: string) => `https://picsum.photos/seed/${seed}/1200/400`,
  flyer: (seed: string) => `https://picsum.photos/seed/${seed}/600/800`,
  gallery: (seed: string, i: number) => `https://picsum.photos/seed/${seed}-g${i}/800/800`,
};

async function main() {
  const users = await prisma.user.findMany({
    take: 8,
    orderBy: { createdAt: "asc" },
    select: { id: true, displayName: true },
  });
  if (users.length < 3) {
    console.error("❌ Te weinig users in de dev-DB (min. 3 nodig). Draai eerst prisma db seed.");
    process.exit(1);
  }
  const [orgA, orgB, orgC] = users;
  const rsvpers = users.slice(1); // iedereen behalve orgA doet ergens aan mee

  const events = [
    {
      id: "evtdemo-utrecht-beurs",
      organizerId: orgA.id,
      eventType: "BEURS",
      status: "LIVE",
      isOfficial: true,
      title: "Grote Pokémon Verzamelbeurs Utrecht",
      description:
        "<p>Dé grootste Pokémon-beurs van Midden-Nederland! Meer dan <strong>120 tafels</strong> vol singles, sealed product, graded kaarten en vintage collecties.</p><ul><li>Gratis kaart-check bij de PSA-stand</li><li>Live veiling om 14:00</li><li>Ruilhoek voor jeugd t/m 12 jaar</li></ul><p>Kom op tijd — de vroege vogels vinden de beste deals!</p>",
      venueName: "Beursgebouw De Vereeniging",
      street: "Mariaplaats", houseNumber: "14", postalCode: "3511 LJ", city: "Utrecht", country: "NL",
      lat: 52.0894, lng: 5.1181, timezone: "Europe/Amsterdam",
      startTime: nl("2026-07-26", "10:00"), endTime: nl("2026-07-26", "17:00"),
      earlyAccessTime: nl("2026-07-26", "09:00"),
      entryType: "PAID", entryPriceMode: "TIERS", entryCurrency: "EUR",
      ticketTypes: JSON.stringify([
        { name: "Standaard", price: 7.5, description: "Toegang vanaf 10:00" },
        { name: "VIP Early Bird", price: 17.5, description: "Vroege toegang vanaf 09:00 + goodiebag", serviceFee: 0.5 },
        { name: "Kind t/m 12 jaar", price: 0, description: "Onder begeleiding gratis" },
      ]),
      registrationUrl: "https://www.eventbrite.nl/",
      vendorOptions: JSON.stringify([
        { name: "Tafel (180 cm)", price: 35, description: "Incl. 2 stoelen en tafelkleed" },
        { name: "Extra stoel", price: 2.5 },
        { name: "Stroomaansluiting", price: 7.5, description: "230V, max 500W" },
      ]),
      vendorInfo: "Aanmelden als standhouder kan tot 2 weken voor de beurs via het aanvraagformulier hieronder of per mail. Vol = vol — we hanteren een wachtlijst.",
      canPlay: true, canTrade: true, canSell: true,
      hasParking: true, hasFood: true, hasToilets: true, hasWifi: true,
      cardPayment: true, wheelchairAccessible: true, hasCloakroom: true, childFriendly: true,
      maxVisitors: 1200, venueSizeM2: 1800, totalTables: 120,
      coverImage: img.banner("utrecht-hall"), flyerImage: img.flyer("utrecht-flyer"),
      galleryImages: JSON.stringify([1, 2, 3, 4, 5, 6].map((i) => img.gallery("utrecht", i))),
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      organizerName: "PokéFairs Nederland",
      organizerWebsite: "https://www.pokefairs.nl",
      socialLinks: JSON.stringify(["https://instagram.com/pokefairs", "https://facebook.com/pokefairs", "https://tiktok.com/@pokefairs"]),
    },
    {
      id: "evtdemo-rotterdam-tradenight",
      organizerId: orgB.id,
      eventType: "TRADE_NIGHT",
      status: "LIVE",
      isOfficial: false,
      title: "Trade Night Rotterdam — zomereditie",
      description:
        "<p>Maandelijkse ruilavond voor verzamelaars uit de regio Rijnmond. Neem je binders mee en ruil onder het genot van een drankje. <strong>Geen verkoop</strong> — puur ruilen en gezelligheid.</p>",
      venueName: "Café De Witte Aap",
      street: "Witte de Withstraat", houseNumber: "78", postalCode: "3012 BS", city: "Rotterdam", country: "NL",
      lat: 51.9163, lng: 4.4768, timezone: "Europe/Amsterdam",
      startTime: nl("2026-07-18", "19:00"), endTime: nl("2026-07-18", "23:00"),
      earlyAccessTime: null,
      entryType: "FREE", entryPriceMode: "TIERS", entryCurrency: null,
      ticketTypes: null, registrationUrl: null,
      vendorOptions: null, vendorInfo: null,
      canPlay: true, canTrade: true, canSell: false,
      hasParking: false, hasFood: true, hasToilets: true, hasWifi: true,
      cardPayment: true, wheelchairAccessible: false, hasCloakroom: false, childFriendly: false,
      maxVisitors: 60, venueSizeM2: null, totalTables: null,
      coverImage: img.banner("rotterdam-cafe"), flyerImage: null,
      galleryImages: JSON.stringify([1, 2, 3].map((i) => img.gallery("rdam", i))),
      videoUrl: null,
      organizerName: null, organizerWebsite: null,
      socialLinks: JSON.stringify(["https://discord.gg/tradenight010"]),
    },
    {
      id: "evtdemo-antwerpen-toernooi",
      organizerId: orgC.id,
      eventType: "OP_TOERNOOI",
      status: "LIVE",
      isOfficial: true,
      title: "Regional Championship Antwerpen",
      description:
        "<p>Officieel Play! Pokémon Regional in het hart van Antwerpen. Swiss-rondes in de ochtend, top-cut vanaf 15:00. Deck-registratie verplicht vóór 09:30.</p><p>Side-events de hele dag: gift-battles, art-contest en een pack-battle-hoek.</p>",
      venueName: "Antwerp Expo — Hal 2",
      street: "Jan Van Rijswijcklaan", houseNumber: "191", postalCode: "2020", city: "Antwerpen", country: "BE",
      lat: 51.1906, lng: 4.3921, timezone: "Europe/Brussels",
      startTime: nl("2026-08-08", "09:00"), endTime: nl("2026-08-08", "19:00"),
      earlyAccessTime: null,
      entryType: "PAID", entryPriceMode: "TIERS", entryCurrency: "EUR",
      ticketTypes: JSON.stringify([
        { name: "Speler", price: 25, description: "Incl. deelname + promo-pack", serviceFee: 1.25 },
        { name: "Toeschouwer", price: 5 },
      ]),
      registrationUrl: "https://rk9.gg/",
      vendorOptions: JSON.stringify([
        { name: "Vendor-booth (3x3m)", price: 150, description: "Alleen erkende retailers" },
      ]),
      vendorInfo: "Vendor-plekken uitsluitend voor geregistreerde TCG-retailers met BTW-nummer.",
      canPlay: true, canTrade: true, canSell: true,
      hasParking: true, hasFood: true, hasToilets: true, hasWifi: false,
      cardPayment: true, wheelchairAccessible: true, hasCloakroom: true, childFriendly: true,
      maxVisitors: 800, venueSizeM2: 2400, totalTables: 40,
      coverImage: img.banner("antwerp-expo"), flyerImage: img.flyer("antwerp-flyer"),
      galleryImages: JSON.stringify([1, 2, 3, 4].map((i) => img.gallery("antwerp", i))),
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      organizerName: "BeNeLux TCG Events",
      organizerWebsite: "https://www.beneluxtcg.be",
      socialLinks: JSON.stringify(["https://instagram.com/beneluxtcg", "https://x.com/beneluxtcg"]),
      tournamentFormat: "Standard (Swiss + Top 8)",
      prizePool: "Boosterboxen + travel award voor de winnaar",
      isSanctioned: true,
    },
    {
      id: "evtdemo-keulen-release",
      organizerId: orgB.id,
      eventType: "RELEASE_EVENT",
      status: "LIVE",
      isOfficial: false,
      title: "Set-Release-Party Köln",
      description:
        "<p>Vier de release van de nieuwste set bij de grootste TCG-winkel van Keulen! Open-house met build-&-battle, winacties en 10% korting op sealed product.</p>",
      venueName: "CardCorner Köln",
      street: "Ehrenstraße", houseNumber: "43", postalCode: "50672", city: "Köln", country: "DE",
      lat: 50.9403, lng: 6.9430, timezone: "Europe/Berlin",
      startTime: nl("2026-08-14", "16:00"), endTime: nl("2026-08-14", "21:00"),
      earlyAccessTime: null,
      entryType: "FREE", entryPriceMode: "TIERS", entryCurrency: null,
      ticketTypes: null, registrationUrl: null,
      vendorOptions: null, vendorInfo: null,
      canPlay: true, canTrade: false, canSell: false,
      hasParking: false, hasFood: false, hasToilets: true, hasWifi: true,
      cardPayment: true, wheelchairAccessible: true, hasCloakroom: false, childFriendly: true,
      maxVisitors: 80, venueSizeM2: 220, totalTables: null,
      coverImage: img.banner("koeln-store"), flyerImage: img.flyer("koeln-flyer"),
      galleryImages: null,
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      organizerName: "CardCorner Köln",
      organizerWebsite: "https://www.cardcorner.de",
      socialLinks: JSON.stringify(["https://instagram.com/cardcornerkoeln"]),
    },
    {
      id: "evtdemo-eindhoven-meetup",
      organizerId: orgC.id,
      eventType: "MEETUP",
      status: "LIVE",
      isOfficial: false,
      title: "Collectors Meetup Eindhoven",
      description:
        "<p>Informele zondagmiddag-meetup voor verzamelaars uit Brabant. Laat je nieuwste pulls zien, praat bij over de markt en leer andere verzamelaars kennen. Iedereen welkom, van beginner tot grader.</p>",
      venueName: "Stadsbrasserie De Blob",
      street: "Emmasingel", houseNumber: "2", postalCode: "5611 AZ", city: "Eindhoven", country: "NL",
      lat: 51.4405, lng: 5.4747, timezone: "Europe/Amsterdam",
      startTime: nl("2026-07-20", "13:00"), endTime: nl("2026-07-20", "17:00"),
      earlyAccessTime: null,
      entryType: "FREE", entryPriceMode: "TIERS", entryCurrency: null,
      ticketTypes: null, registrationUrl: null,
      vendorOptions: null, vendorInfo: null,
      canPlay: false, canTrade: true, canSell: false,
      hasParking: true, hasFood: true, hasToilets: true, hasWifi: true,
      cardPayment: true, wheelchairAccessible: true, hasCloakroom: false, childFriendly: true,
      maxVisitors: 40, venueSizeM2: null, totalTables: null,
      coverImage: img.banner("eindhoven-meetup"), flyerImage: null,
      galleryImages: JSON.stringify([1, 2].map((i) => img.gallery("ehv", i))),
      videoUrl: null,
      organizerName: null, organizerWebsite: null,
      socialLinks: null,
    },
    {
      id: "evtdemo-gent-beurs",
      organizerId: orgA.id,
      eventType: "BEURS",
      status: "LIVE",
      isOfficial: false,
      title: "Vlaamse Kaartenbeurs Gent",
      description:
        "<p>Gezellige regionale beurs met 45 tafels — Pokémon, met een hoekje voor andere TCG's. Bekende Vlaamse en Nederlandse handelaren aanwezig, plus een grading-infostand.</p>",
      venueName: "ICC Gent",
      street: "Van Rysselberghedreef", houseNumber: "2", postalCode: "9000", city: "Gent", country: "BE",
      lat: 51.0362, lng: 3.7373, timezone: "Europe/Brussels",
      startTime: nl("2026-08-30", "10:00"), endTime: nl("2026-08-30", "16:30"),
      earlyAccessTime: nl("2026-08-30", "09:15"),
      entryType: "PAID", entryPriceMode: "TIERS", entryCurrency: "EUR",
      ticketTypes: JSON.stringify([
        { name: "Entree", price: 5, description: "Toegang vanaf 10:00" },
        { name: "Early Access", price: 12.5, description: "Binnen vanaf 09:15" },
      ]),
      registrationUrl: null, // aan de deur
      vendorOptions: JSON.stringify([
        { name: "Tafel (200 cm)", price: 40, description: "Incl. 2 stoelen" },
        { name: "Hoektafel", price: 55, description: "Dubbele zichtbaarheid, beperkt beschikbaar" },
      ]),
      vendorInfo: "Reserveren via de aanvraagknop of mail naar info@vlaamsekaartenbeurs.be.",
      canPlay: false, canTrade: true, canSell: true,
      hasParking: true, hasFood: true, hasToilets: true, hasWifi: false,
      cardPayment: false, wheelchairAccessible: true, hasCloakroom: true, childFriendly: true,
      maxVisitors: 500, venueSizeM2: 900, totalTables: 45,
      coverImage: img.banner("gent-hall"), flyerImage: img.flyer("gent-flyer"),
      galleryImages: JSON.stringify([1, 2, 3, 4, 5].map((i) => img.gallery("gent", i))),
      videoUrl: null,
      organizerName: "Vlaamse Kaartenbeurs vzw",
      organizerWebsite: "https://www.vlaamsekaartenbeurs.be",
      socialLinks: JSON.stringify(["https://facebook.com/vlaamsekaartenbeurs", "https://instagram.com/vlaamsekaartenbeurs"]),
    },
  ];

  for (const e of events) {
    const { id, ...data } = e;
    await prisma.event.upsert({
      where: { id },
      create: { id, publishedAt: new Date(), ...data },
      update: data,
    });
    console.log(`✓ event: ${e.title}`);
  }

  // ── RSVP's: verdeel users over de events (niet op eigen events) ──
  const rsvpPlan: Array<{ eventId: string; status: "GOING" | "INTERESTED" }> = [
    { eventId: "evtdemo-utrecht-beurs", status: "GOING" },
    { eventId: "evtdemo-utrecht-beurs", status: "GOING" },
    { eventId: "evtdemo-utrecht-beurs", status: "INTERESTED" },
    { eventId: "evtdemo-utrecht-beurs", status: "INTERESTED" },
    { eventId: "evtdemo-rotterdam-tradenight", status: "GOING" },
    { eventId: "evtdemo-rotterdam-tradenight", status: "INTERESTED" },
    { eventId: "evtdemo-antwerpen-toernooi", status: "GOING" },
    { eventId: "evtdemo-gent-beurs", status: "INTERESTED" },
  ];
  const organizerByEvent = new Map(events.map((e) => [e.id, e.organizerId]));
  let cursor = 0;
  let rsvpCount = 0;
  for (const plan of rsvpPlan) {
    // volgende user die niet de organisator is
    let tries = 0;
    let user = rsvpers[cursor % rsvpers.length];
    while (user.id === organizerByEvent.get(plan.eventId) && tries < rsvpers.length) {
      cursor++; tries++;
      user = rsvpers[cursor % rsvpers.length];
    }
    cursor++;
    await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId: plan.eventId, userId: user.id } },
      create: { eventId: plan.eventId, userId: user.id, status: plan.status },
      update: { status: plan.status },
    });
    rsvpCount++;
  }
  console.log(`✓ ${rsvpCount} RSVP's`);

  // ── Standhouder-aanvragen: goedgekeurd + in behandeling ──
  const vendorPlan: Array<{ eventId: string; status: "APPROVED" | "PENDING"; message: string }> = [
    { eventId: "evtdemo-utrecht-beurs", status: "APPROVED", message: "Wij staan er met vintage singles en graded slabs — 3 tafels graag." },
    { eventId: "evtdemo-utrecht-beurs", status: "APPROVED", message: "Sealed product (ETB's en boosterboxen), pin aanwezig." },
    { eventId: "evtdemo-utrecht-beurs", status: "PENDING", message: "Eerste keer als standhouder, verkoop japanse singles." },
    { eventId: "evtdemo-gent-beurs", status: "APPROVED", message: "Vaste standhouder — hoektafel indien mogelijk." },
    { eventId: "evtdemo-gent-beurs", status: "PENDING", message: "Graag een tafel voor moderne singles en accessoires." },
  ];
  let vendorCount = 0;
  cursor = 0;
  for (const plan of vendorPlan) {
    let tries = 0;
    let user = rsvpers[cursor % rsvpers.length];
    while (user.id === organizerByEvent.get(plan.eventId) && tries < rsvpers.length) {
      cursor++; tries++;
      user = rsvpers[cursor % rsvpers.length];
    }
    cursor++;
    await prisma.eventVendorRequest.upsert({
      where: { eventId_userId: { eventId: plan.eventId, userId: user.id } },
      create: {
        eventId: plan.eventId,
        userId: user.id,
        status: plan.status,
        message: plan.message,
        decidedAt: plan.status === "APPROVED" ? new Date() : null,
      },
      update: {
        status: plan.status,
        message: plan.message,
        decidedAt: plan.status === "APPROVED" ? new Date() : null,
      },
    });
    vendorCount++;
  }
  console.log(`✓ ${vendorCount} standhouder-aanvragen`);

  console.log("\n✅ Demo-events geseed. Bekijk /nl/evenementen");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
