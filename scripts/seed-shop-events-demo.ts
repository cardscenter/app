/**
 * Demo-winkel-events voor lokaal testen (Community Hub, Fase 3).
 *   npx tsx scripts/seed-shop-events-demo.ts
 * Idempotent (herkent op titel-prefix "[demo]"), dev-only: weigert op een
 * libsql://-URL. Maakt de standaard event-types aan als die ontbreken en
 * zet 5 gepubliceerde events in de komende weken (gratis + betaald, met
 * een klein event om de wachtlijst te testen).
 */
import { prisma } from "../src/lib/prisma";
import { DEFAULT_EVENT_TYPES } from "../src/lib/shop-events/config";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:dev.db";
  if (url.startsWith("libsql://")) throw new Error("Dev-only: weigert op een live Turso-database.");

  const admin = await prisma.user.findFirst({ where: { accountType: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("Geen admin-account gevonden; draai eerst de seed.");

  for (const t of DEFAULT_EVENT_TYPES) {
    await prisma.eventType.upsert({
      where: { key: t.key },
      create: {
        key: t.key,
        name: t.name,
        game: t.game,
        description: t.description,
        color: t.color,
        ageDivisions: t.ageDivisions ? JSON.stringify(t.ageDivisions) : null,
        defaultPrice: t.defaultPrice,
        defaultCapacity: t.defaultCapacity,
        countsForLeague: t.countsForLeague,
        countsForStampCard: t.countsForStampCard,
        sortOrder: t.sortOrder,
      },
      update: {},
    });
  }
  const types = Object.fromEntries((await prisma.eventType.findMany()).map((t) => [t.key, t]));

  // Volgende dinsdag 19:00 (winkel-tijd ≈ UTC+2 in oktober; demo-data, dus benadering is prima).
  const now = new Date();
  const nextTuesday = new Date(now);
  nextTuesday.setUTCDate(now.getUTCDate() + ((2 - now.getUTCDay() + 7) % 7 || 7));
  nextTuesday.setUTCHours(17, 0, 0, 0);
  const at = (daysFromTuesday: number, hour: number) => new Date(nextTuesday.getTime() + daysFromTuesday * 86_400_000 + (hour - 17) * 3600_000);

  const demos = [
    { key: "league-avond", title: "[demo] League-avond Pokémon", start: at(0, 17), hours: 3.5, price: 0, capacity: 28 },
    { key: "toernooi", title: "[demo] Standard-toernooi", start: at(4, 11), hours: 6, price: 5, capacity: 24, desc: "Swiss-rondes, Best of 1, 30 minuten per ronde. Decklist inleveren bij check-in. Prijzen: boosters per gewonnen ronde." },
    { key: "pre-release", title: "[demo] Pre-release nieuwe set", start: at(11, 12), hours: 5, price: 30, capacity: 2, desc: "Inclusief pre-release kit. Capaciteit bewust klein in deze demo om de wachtlijst te testen." },
    { key: "vrij-spelen", title: "[demo] Vrij spelen en ruilen", start: at(7, 17), hours: 3, price: 0, capacity: null },
    { key: "league-avond", title: "[demo] League-avond Yu-Gi-Oh!", start: at(2, 17), hours: 3.5, price: 0, capacity: 20, game: "yugioh" },
  ];

  for (const d of demos) {
    const type = types[d.key];
    const existing = await prisma.shopEvent.findFirst({ where: { title: d.title } });
    if (existing) {
      console.log("bestaat al:", d.title);
      continue;
    }
    await prisma.shopEvent.create({
      data: {
        typeId: type.id,
        title: d.title,
        description: d.desc ?? type.description,
        game: d.game ?? type.game,
        startsAt: d.start,
        endsAt: new Date(d.start.getTime() + d.hours * 3600_000),
        price: d.price,
        capacity: d.capacity,
        countsForLeague: type.countsForLeague,
        countsForStampCard: type.countsForStampCard,
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdById: admin.id,
      },
    });
    console.log("aangemaakt:", d.title, d.start.toISOString());
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
