import "server-only";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";
import { DEFAULT_BADGES, calcResultPoints, rankStandings, type BadgeCriterion, type StandingRow } from "./config";

/**
 * League-service (Fase 5): seizoenen, uitslagen, ranglijst, badges.
 */

let seeded = false;
export async function ensureLeagueDefaults(): Promise<void> {
  if (seeded) return;
  if ((await prisma.leagueBadge.count()) === 0) {
    for (const b of DEFAULT_BADGES) await prisma.leagueBadge.upsert({ where: { key: b.key }, create: b, update: {} });
  }
  seeded = true;
}

export async function getActiveSeason() {
  return prisma.leagueSeason.findFirst({ where: { status: "ACTIVE" }, orderBy: { startsAt: "desc" } });
}

export interface StandingView extends StandingRow {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  isViewer: boolean;
}

/**
 * Ranglijst van een seizoen. Publiek alleen spelers met `showOnLeaderboards`;
 * de kijker ziet zichzelf altijd (met rang zoals in de volledige lijst).
 */
export async function getStandings(seasonId: string, viewerId: string | null): Promise<StandingView[]> {
  const rows = await prisma.leagueResult.groupBy({
    by: ["userId"],
    where: { seasonId },
    _sum: { points: true, wins: true, losses: true, draws: true },
    _count: { _all: true },
  });
  const all: StandingRow[] = rows.map((r) => ({
    userId: r.userId,
    points: r._sum.points ?? 0,
    wins: r._sum.wins ?? 0,
    losses: r._sum.losses ?? 0,
    draws: r._sum.draws ?? 0,
    events: r._count._all,
  }));
  const ranked = rankStandings(all);
  const users = await prisma.user.findMany({
    where: { id: { in: ranked.map((r) => r.userId) } },
    select: { id: true, displayName: true, avatarUrl: true, showOnLeaderboards: true, deletedAt: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return ranked
    .filter((r) => {
      const u = byId.get(r.userId);
      return u && !u.deletedAt && (u.showOnLeaderboards || r.userId === viewerId);
    })
    .map((r) => {
      const u = byId.get(r.userId)!;
      return { ...r, displayName: u.showOnLeaderboards || r.userId === viewerId ? u.displayName : "Anoniem", avatarUrl: u.avatarUrl, isViewer: r.userId === viewerId };
    });
}

/** Uitslag invoeren/bijwerken (staff). Punten volgens de seizoensregels. */
export async function upsertResult(args: {
  seasonId: string;
  eventId: string | null;
  userId: string;
  wins: number;
  losses: number;
  draws: number;
  bonusPoints?: number;
  note?: string | null;
  enteredById: string;
}): Promise<{ ok: true; points: number } | { error: string }> {
  const season = await prisma.leagueSeason.findUnique({ where: { id: args.seasonId } });
  if (!season) return { error: "Seizoen niet gevonden" };
  if (season.status !== "ACTIVE") return { error: "Dit seizoen is niet actief" };
  const points = calcResultPoints(args, season);
  const data = {
    wins: Math.max(0, Math.floor(args.wins)),
    losses: Math.max(0, Math.floor(args.losses)),
    draws: Math.max(0, Math.floor(args.draws)),
    bonusPoints: Math.floor(args.bonusPoints ?? 0),
    points,
    note: args.note?.trim() || null,
    enteredById: args.enteredById,
  };
  const existing = await prisma.leagueResult.findFirst({ where: { seasonId: args.seasonId, eventId: args.eventId, userId: args.userId } });
  if (existing) await prisma.leagueResult.update({ where: { id: existing.id }, data });
  else await prisma.leagueResult.create({ data: { ...data, seasonId: args.seasonId, eventId: args.eventId, userId: args.userId } });
  await awardBadgesFor(args.userId, args.seasonId);
  return { ok: true, points };
}

export async function deleteResult(id: string): Promise<void> {
  await prisma.leagueResult.delete({ where: { id } }).catch(() => {});
}

/** Badges toekennen die de speler nu haalt (idempotent via unique). */
export async function awardBadgesFor(userId: string, seasonId: string | null): Promise<string[]> {
  await ensureLeagueDefaults();
  const badges = await prisma.leagueBadge.findMany({ where: { enabled: true } });
  if (badges.length === 0) return [];
  const [seasonAgg, totalEvents, totalStamps] = await Promise.all([
    seasonId
      ? prisma.leagueResult.aggregate({ where: { userId, seasonId }, _sum: { points: true, wins: true }, _count: { _all: true } })
      : Promise.resolve(null),
    prisma.leagueResult.count({ where: { userId } }),
    prisma.loyaltyEntry.aggregate({ where: { userId, kind: "STAMP", delta: { gt: 0 } }, _sum: { delta: true } }),
  ]);
  const value = (c: BadgeCriterion): number | null => {
    switch (c) {
      case "SEASON_POINTS":
        return seasonAgg ? (seasonAgg._sum.points ?? 0) : null;
      case "SEASON_EVENTS":
        return seasonAgg ? seasonAgg._count._all : null;
      case "SEASON_WINS":
        return seasonAgg ? (seasonAgg._sum.wins ?? 0) : null;
      case "TOTAL_EVENTS":
        return totalEvents;
      case "TOTAL_STAMPS":
        return totalStamps._sum.delta ?? 0;
    }
  };
  const awarded: string[] = [];
  for (const b of badges) {
    const v = value(b.criterion as BadgeCriterion);
    if (v === null || v < b.threshold) continue;
    const seasonScoped = b.criterion.startsWith("SEASON_");
    const sid = seasonScoped ? seasonId : null;
    const exists = await prisma.userLeagueBadge.findFirst({ where: { userId, badgeId: b.id, seasonId: sid } });
    if (exists) continue;
    await prisma.userLeagueBadge.create({ data: { userId, badgeId: b.id, seasonId: sid } });
    awarded.push(b.name);
    await createNotification(userId, "LEAGUE_BADGE", `Badge verdiend: ${b.name}`, b.description ?? `Je hebt de badge ${b.name} verdiend.`, "/dashboard/league");
  }
  return awarded;
}

export interface UserLeagueSummary {
  season: { id: string; name: string } | null;
  rank: number | null;
  points: number;
  events: number;
  wins: number;
  losses: number;
  draws: number;
  badges: Array<{ key: string; name: string; description: string | null; color: string; awardedAt: string; seasonName: string | null }>;
  recentResults: Array<{ id: string; eventTitle: string | null; date: string; wins: number; losses: number; draws: number; points: number; seasonName: string }>;
}

export async function getUserLeagueSummary(userId: string): Promise<UserLeagueSummary> {
  const season = await getActiveSeason();
  const [standing, badges, results] = await Promise.all([
    season ? getStandings(season.id, userId) : Promise.resolve([]),
    prisma.userLeagueBadge.findMany({ where: { userId }, include: { badge: true, season: { select: { name: true } } }, orderBy: { awardedAt: "desc" } }),
    prisma.leagueResult.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10, include: { event: { select: { title: true, startsAt: true } }, season: { select: { name: true } } } }),
  ]);
  const mine = standing.find((s) => s.isViewer);
  return {
    season: season ? { id: season.id, name: season.name } : null,
    rank: mine?.rank ?? null,
    points: mine?.points ?? 0,
    events: mine?.events ?? 0,
    wins: mine?.wins ?? 0,
    losses: mine?.losses ?? 0,
    draws: mine?.draws ?? 0,
    badges: badges.map((b) => ({ key: b.badge.key, name: b.badge.name, description: b.badge.description, color: b.badge.color, awardedAt: b.awardedAt.toISOString(), seasonName: b.season?.name ?? null })),
    recentResults: results.map((r) => ({
      id: r.id,
      eventTitle: r.event?.title ?? null,
      date: (r.event?.startsAt ?? r.createdAt).toISOString(),
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      points: r.points,
      seasonName: r.season.name,
    })),
  };
}

/** Badges van een speler voor het publieke profiel. */
export async function getPublicBadges(userId: string) {
  const rows = await prisma.userLeagueBadge.findMany({ where: { userId }, include: { badge: true }, orderBy: { badge: { sortOrder: "asc" } } });
  return rows.map((r) => ({ key: r.badge.key, name: r.badge.name, description: r.badge.description, color: r.badge.color }));
}

/** Deelnemers van een event met hun bestaande uitslag (voor het staff-scherm). */
export async function getEventResultSheet(eventId: string | null, seasonId: string) {
  const [regs, results] = await Promise.all([
    eventId
      ? prisma.eventRegistration.findMany({
          where: { eventId, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
          orderBy: { user: { displayName: "asc" } },
        })
      : Promise.resolve([]),
    prisma.leagueResult.findMany({ where: { eventId, seasonId }, include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } }),
  ]);
  const byUser = new Map(results.map((r) => [r.userId, r]));
  const toResult = (res: (typeof results)[number]) => ({ id: res.id, wins: res.wins, losses: res.losses, draws: res.draws, bonusPoints: res.bonusPoints, points: res.points, note: res.note });
  const rows = regs.map((r) => {
    const res = byUser.get(r.userId);
    return { userId: r.userId, displayName: r.user.displayName, avatarUrl: r.user.avatarUrl, checkedIn: r.status === "CHECKED_IN", result: res ? toResult(res) : null };
  });
  // Uitslagen van spelers zonder inschrijving (toegevoegd door staff) ook tonen.
  for (const res of results) {
    if (!rows.some((r) => r.userId === res.userId)) rows.push({ userId: res.userId, displayName: res.user.displayName, avatarUrl: res.user.avatarUrl, checkedIn: false, result: toResult(res) });
  }
  return rows;
}
