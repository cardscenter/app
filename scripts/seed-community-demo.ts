/**
 * Demo-data voor league, stempelkaart en nieuws (Community Hub, Fase 5).
 *   npx tsx scripts/seed-community-demo.ts
 * Idempotent (herkent op naam-prefix "[demo]"), dev-only: weigert op een
 * libsql://-URL. Maakt een actief seizoen met uitslagen voor de eerste zes
 * spelers, geeft ze stempels/punten, en zet drie nieuwsberichten online.
 */
import { prisma } from "../src/lib/prisma";
import { DEFAULT_BADGES, calcResultPoints } from "../src/lib/community/config";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:dev.db";
  if (url.startsWith("libsql://")) throw new Error("Dev-only: weigert op een live Turso-database.");
  const admin = await prisma.user.findFirst({ where: { accountType: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("Geen admin-account gevonden.");
  const players = await prisma.user.findMany({ where: { accountType: { not: "ADMIN" }, deletedAt: null }, select: { id: true, displayName: true }, take: 6, orderBy: { createdAt: "asc" } });
  if (players.length === 0) throw new Error("Geen spelers gevonden; maak eerst accounts aan.");

  for (const b of DEFAULT_BADGES) await prisma.leagueBadge.upsert({ where: { key: b.key }, create: b, update: {} });

  const now = new Date();
  let season = await prisma.leagueSeason.findFirst({ where: { name: { startsWith: "[demo]" } } });
  if (!season) {
    await prisma.leagueSeason.updateMany({ where: { status: "ACTIVE" }, data: { status: "CLOSED" } });
    season = await prisma.leagueSeason.create({
      data: { name: "[demo] Winter 2026/2027", startsAt: new Date(now.getTime() - 20 * 86_400_000), endsAt: new Date(now.getTime() + 70 * 86_400_000), status: "ACTIVE", description: "Demo-seizoen. League-avonden op dinsdag, toernooien op zaterdag." },
    });
    console.log("seizoen aangemaakt:", season.name);
  } else console.log("seizoen bestaat al:", season.name);

  const events = await prisma.shopEvent.findMany({ where: { countsForLeague: true, status: { in: ["PUBLISHED", "COMPLETED"] } }, orderBy: { startsAt: "asc" }, take: 2, select: { id: true, title: true } });
  const rounds = [events[0]?.id ?? null, events[1]?.id ?? null, null];
  let created = 0;
  for (const [ri, eventId] of rounds.entries()) {
    for (const [pi, p] of players.entries()) {
      const exists = await prisma.leagueResult.findFirst({ where: { seasonId: season.id, eventId, userId: p.id } });
      if (exists) continue;
      const wins = Math.max(0, 3 - ((pi + ri) % 4));
      const losses = 3 - wins;
      const r = { wins, losses, draws: 0, bonusPoints: ri === 2 && pi === 0 ? 1 : 0 };
      await prisma.leagueResult.create({ data: { seasonId: season.id, eventId, userId: p.id, ...r, points: calcResultPoints(r, season), enteredById: admin.id, note: ri === 2 ? "[demo] inhaalronde" : null } });
      created++;
    }
  }
  console.log(`uitslagen aangemaakt: ${created}`);

  for (const [pi, p] of players.entries()) {
    const have = await prisma.loyaltyEntry.count({ where: { userId: p.id, reason: { startsWith: "[demo]" } } });
    if (have > 0) continue;
    const stamps = Math.min(9, 2 + pi * 2);
    for (let i = 0; i < stamps; i++) await prisma.loyaltyEntry.create({ data: { userId: p.id, kind: "STAMP", delta: 1, reason: `[demo] League-avond ${i + 1}`, source: "CHECKIN", staffId: admin.id } });
    await prisma.loyaltyEntry.create({ data: { userId: p.id, kind: "POINTS", delta: stamps * 10, reason: `[demo] Check-ins`, source: "CHECKIN", staffId: admin.id } });
  }
  // Badges: de echte toekenning (awardBadgesFor) zit achter server-only; hier
  // alleen de eerste-avond-badge, de rest verdienen spelers via check-in/uitslag.
  const first = await prisma.leagueBadge.findUnique({ where: { key: "bagijnepoort" } });
  if (first) for (const p of players) {
    const has = await prisma.userLeagueBadge.findFirst({ where: { userId: p.id, badgeId: first.id } });
    if (!has) await prisma.userLeagueBadge.create({ data: { userId: p.id, badgeId: first.id, seasonId: null } });
  }
  console.log("stempels/punten gezet voor", players.map((p) => p.displayName).join(", "));

  const posts = [
    { slug: "demo-opening-zomer-2027", title: "[demo] We openen in de zomer van 2027", excerpt: "De sleutel is binnen. Vanaf december verbouwen we Dubbele Poort 7 tot een winkel met veertien speeltafels, een bar en een echte community-ruimte.", pinned: true, body: "De sleutel van Dubbele Poort 7 is binnen! De komende maanden verbouwen we het pand tot een winkel waar je niet alleen kaarten koopt, maar ook speelt, ruilt en elkaar ontmoet.\n\nWat je kunt verwachten: veertien speeltafels, een bar met friet, snacks en drinken, wekelijkse league-avonden en toernooien, pre-releases van elke nieuwe set en een stempelkaart voor wie vaak komt.\n\nHoud deze site in de gaten: zodra de openingsdatum vaststaat lees je het hier als eerste. Zet de nieuwsbrief aan in je instellingen om niets te missen." },
    { slug: "demo-league-seizoen-start", title: "[demo] Het eerste league-seizoen is begonnen", excerpt: "Elke dinsdagavond league, elke zaterdag een toernooi. Punten tellen op in de ranglijst en leveren badges op.", pinned: false, body: "Het eerste league-seizoen loopt! Elke dinsdagavond spelen we vanaf 19:00, op zaterdag zijn er toernooien.\n\nZo werkt het: schrijf je in via de evenementenpagina, laat je ticket scannen bij de deur en speel je partijen. Staff voert de uitslag in en je punten tellen direct mee in de ranglijst.\n\nWie goed presteert verdient badges: de poorten van Hulst. Je ziet ze op je profiel." },
    { slug: "demo-eten-bestellen-aan-tafel", title: "[demo] Bestel friet en drinken vanaf je speeltafel", excerpt: "Scan de QR-code op je tafel, kies je friet, saus en drankje, en wij brengen het naar je toe.", pinned: false, body: "Honger tijdens een lange ronde? Op elke speeltafel staat een QR-code. Scan hem, kies wat je wilt en betaal online of aan de bar.\n\nMet een burger of friet krijg je menuvoordeel op je drankje. Je ziet op je telefoon hoe lang het nog duurt en wij brengen het naar je tafel. Jij hoeft niets op te ruimen." },
  ];
  for (const p of posts) {
    const exists = await prisma.newsPost.findUnique({ where: { slug: p.slug } });
    if (exists) continue;
    await prisma.newsPost.create({ data: { ...p, status: "PUBLISHED", publishedAt: new Date(now.getTime() - posts.indexOf(p) * 3 * 86_400_000), authorId: admin.id } });
  }
  console.log("nieuwsberichten: klaar");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
