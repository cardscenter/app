import "server-only";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";
import { getHubSettings } from "@/lib/app-config";
import { completesCard, stampCardState } from "./config";
import { awardBadgesFor } from "./league";

/**
 * Stempelkaart + spaarpunten (Fase 5). Eén grootboek `LoyaltyEntry`:
 * saldo = som van `delta` per `kind`. Nooit geld: punten worden door staff
 * aan de kassa ingewisseld (negatieve entry met source REDEEM).
 */

export interface LoyaltySummary {
  stamps: { total: number; onCard: number; completedCards: number; remaining: number; perCard: number; reward: string };
  points: { balance: number; perCheckIn: number; perFullCard: number };
  recent: Array<{ id: string; kind: "STAMP" | "POINTS"; delta: number; reason: string; source: string; createdAt: string }>;
}

async function totals(userId: string): Promise<{ stamps: number; points: number }> {
  const rows = await prisma.loyaltyEntry.groupBy({ by: ["kind"], where: { userId }, _sum: { delta: true } });
  const get = (k: string) => rows.find((r) => r.kind === k)?._sum.delta ?? 0;
  return { stamps: get("STAMP"), points: get("POINTS") };
}

export async function getLoyaltySummary(userId: string): Promise<LoyaltySummary> {
  const [settings, t, recent] = await Promise.all([
    getHubSettings(),
    totals(userId),
    prisma.loyaltyEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const card = stampCardState(t.stamps, settings.stampsPerCard);
  return {
    stamps: { total: t.stamps, ...card, perCard: settings.stampsPerCard, reward: settings.stampReward },
    points: { balance: t.points, perCheckIn: settings.pointsPerCheckIn, perFullCard: settings.pointsPerFullCard },
    recent: recent.map((r) => ({ id: r.id, kind: r.kind as "STAMP" | "POINTS", delta: r.delta, reason: r.reason, source: r.source, createdAt: r.createdAt.toISOString() })),
  };
}

export async function getPointsBalance(userId: string): Promise<number> {
  return (await totals(userId)).points;
}

/**
 * Eén stempel bijschrijven. Maakt een kaart vol → bonuspunten + melding.
 * Idempotent per event: een tweede stempel voor hetzelfde event wordt geweigerd.
 */
export async function addStamp(args: { userId: string; reason: string; source: "CHECKIN" | "STAFF"; eventId?: string | null; staffId?: string | null }): Promise<{ added: boolean; fullCard: boolean; total: number }> {
  if (args.eventId) {
    const dup = await prisma.loyaltyEntry.findFirst({ where: { userId: args.userId, kind: "STAMP", eventId: args.eventId, delta: { gt: 0 } } });
    if (dup) return { added: false, fullCard: false, total: (await totals(args.userId)).stamps };
  }
  const settings = await getHubSettings();
  await prisma.loyaltyEntry.create({ data: { userId: args.userId, kind: "STAMP", delta: 1, reason: args.reason, source: args.source, eventId: args.eventId ?? null, staffId: args.staffId ?? null } });
  const total = (await totals(args.userId)).stamps;
  const full = completesCard(total, settings.stampsPerCard);
  if (full) {
    if (settings.pointsPerFullCard > 0) {
      await prisma.loyaltyEntry.create({ data: { userId: args.userId, kind: "POINTS", delta: settings.pointsPerFullCard, reason: "Volle stempelkaart", source: "FULL_CARD", eventId: args.eventId ?? null, staffId: args.staffId ?? null } });
    }
    await createNotification(
      args.userId,
      "LOYALTY_FULL_CARD",
      "Je stempelkaart is vol!",
      `${settings.stampsPerCard} stempels verzameld. ${settings.stampReward}${settings.pointsPerFullCard > 0 ? ` Plus ${settings.pointsPerFullCard} spaarpunten erbij.` : ""}`,
      "/dashboard/league",
    );
  }
  await awardBadgesFor(args.userId, null);
  return { added: true, fullCard: full, total };
}

export async function addPoints(args: { userId: string; delta: number; reason: string; source: "CHECKIN" | "STAFF" | "FULL_CARD"; eventId?: string | null; staffId?: string | null }): Promise<void> {
  const d = Math.floor(args.delta);
  if (d <= 0) return;
  await prisma.loyaltyEntry.create({ data: { userId: args.userId, kind: "POINTS", delta: d, reason: args.reason, source: args.source, eventId: args.eventId ?? null, staffId: args.staffId ?? null } });
}

/** Staff wisselt punten in aan de kassa. Nooit onder nul. */
export async function redeemPoints(args: { userId: string; points: number; reason: string; staffId: string }): Promise<{ ok: true; balance: number } | { error: string }> {
  const p = Math.floor(args.points);
  if (p <= 0) return { error: "Aantal punten moet groter dan 0 zijn" };
  const balance = await getPointsBalance(args.userId);
  if (balance < p) return { error: `Niet genoeg punten (saldo ${balance})` };
  await prisma.loyaltyEntry.create({ data: { userId: args.userId, kind: "POINTS", delta: -p, reason: args.reason, source: "REDEEM", staffId: args.staffId } });
  await createNotification(args.userId, "LOYALTY_REDEEMED", `${p} spaarpunten ingewisseld`, `${args.reason}. Nieuw saldo: ${balance - p} punten.`, "/dashboard/league");
  return { ok: true, balance: balance - p };
}

/**
 * Haak voor de check-in (aangeroepen vanuit `checkInByCode` na een geslaagde
 * eerste check-in). Fouten mogen de check-in nooit breken.
 */
export async function onCheckIn(args: { userId: string; eventId: string; eventTitle: string; countsForStampCard: boolean; staffId: string }): Promise<void> {
  try {
    const settings = await getHubSettings();
    if (args.countsForStampCard) {
      await addStamp({ userId: args.userId, reason: `Check-in: ${args.eventTitle}`, source: "CHECKIN", eventId: args.eventId, staffId: args.staffId });
    }
    if (settings.pointsPerCheckIn > 0) {
      const dup = await prisma.loyaltyEntry.findFirst({ where: { userId: args.userId, kind: "POINTS", source: "CHECKIN", eventId: args.eventId } });
      if (!dup) await addPoints({ userId: args.userId, delta: settings.pointsPerCheckIn, reason: `Check-in: ${args.eventTitle}`, source: "CHECKIN", eventId: args.eventId, staffId: args.staffId });
    }
  } catch (e) {
    console.error("[loyalty] onCheckIn mislukt", e);
  }
}

/** Zoek een speler op naam/e-mail voor de staff-schermen (spaarkaart, uitslagen). */
export async function searchPlayers(q: string, take = 8) {
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await prisma.user.findMany({
    where: { deletedAt: null, OR: [{ displayName: { contains: term } }, { email: { contains: term.toLowerCase() } }, { firstName: { contains: term } }, { lastName: { contains: term } }] },
    select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
    take,
    orderBy: { displayName: "asc" },
  });
  const out = [];
  for (const r of rows) {
    const t = await totals(r.id);
    out.push({ id: r.id, displayName: r.displayName, fullName: [r.firstName, r.lastName].filter(Boolean).join(" "), avatarUrl: r.avatarUrl, stamps: t.stamps, points: t.points });
  }
  return out;
}
