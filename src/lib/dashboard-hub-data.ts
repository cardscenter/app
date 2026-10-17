import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getHubSettings } from "@/lib/app-config";
import { fullCardReward, stampCardState, type FullCardReward } from "@/lib/community/config";
import { getActiveSeason, getStandings } from "@/lib/community/league";

/**
 * Data voor de hub-dashboardhome (design-pass ronde G, 2026-10-17): alles wat
 * de speler in één oogopslag wil zien. Bewust lichte queries (geen QR's, geen
 * volledige lijsten); de detailpagina's laden de rest.
 */
export interface HubDashboardData {
  nextTicket: { code: string; eventId: string; title: string; startsAt: string; status: string } | null;
  ticketCount: number;
  nextEvent: { id: string; title: string; startsAt: string } | null;
  stamps: { onCard: number; perCard: number; completedCards: number; reward: FullCardReward };
  points: number;
  league: { seasonName: string; rank: number | null; points: number; players: number } | null;
  recentOrders: { id: string; number: number; status: string; total: number; createdAt: string }[];
  openBuyback: { id: string; status: string; type: string; estimatedPayout: number; createdAt: string } | null;
}

const OPEN_BUYBACK_STATUSES = ["PENDING", "RECEIVED", "INSPECTING", "APPROVED", "PARTIALLY_APPROVED", "RETURN_REQUESTED"];

export const getHubDashboardData = cache(async (userId: string): Promise<HubDashboardData> => {
  const now = new Date();
  const [tickets, ticketCount, nextEvent, settings, loyalty, season, orders, buyback] = await Promise.all([
    prisma.eventRegistration.findFirst({
      where: { userId, status: { in: ["CONFIRMED", "CHECKED_IN", "OFFERED", "WAITLIST"] }, event: { startsAt: { gte: now }, status: "PUBLISHED" } },
      orderBy: { event: { startsAt: "asc" } },
      select: { ticketCode: true, status: true, event: { select: { id: true, title: true, startsAt: true } } },
    }),
    prisma.eventRegistration.count({
      where: { userId, status: { in: ["CONFIRMED", "CHECKED_IN"] }, event: { startsAt: { gte: now }, status: "PUBLISHED" } },
    }),
    prisma.shopEvent.findFirst({
      where: { status: "PUBLISHED", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, startsAt: true },
    }),
    getHubSettings(),
    prisma.loyaltyEntry.groupBy({ by: ["kind"], where: { userId }, _sum: { delta: true } }),
    getActiveSeason(),
    prisma.foodOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, number: true, status: true, total: true, tip: true, createdAt: true },
    }),
    prisma.buybackRequest.findFirst({
      where: { userId, status: { in: OPEN_BUYBACK_STATUSES } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, type: true, estimatedPayout: true, createdAt: true },
    }),
  ]);

  const stampTotal = loyalty.find((l) => l.kind === "STAMP")?._sum.delta ?? 0;
  const points = loyalty.find((l) => l.kind === "POINTS")?._sum.delta ?? 0;
  const card = stampCardState(Math.max(0, stampTotal), settings.stampsPerCard);

  let league: HubDashboardData["league"] = null;
  if (season) {
    const standings = await getStandings(season.id, userId);
    const mine = standings.find((s) => s.isViewer);
    league = { seasonName: season.name, rank: mine?.rank ?? null, points: mine?.points ?? 0, players: standings.length };
  }

  return {
    nextTicket: tickets
      ? { code: tickets.ticketCode, eventId: tickets.event.id, title: tickets.event.title, startsAt: tickets.event.startsAt.toISOString(), status: tickets.status }
      : null,
    ticketCount,
    nextEvent: nextEvent ? { id: nextEvent.id, title: nextEvent.title, startsAt: nextEvent.startsAt.toISOString() } : null,
    stamps: { onCard: card.onCard, perCard: settings.stampsPerCard, completedCards: card.completedCards, reward: fullCardReward(settings) },
    points: Math.max(0, points),
    league,
    recentOrders: orders.map((o) => ({ id: o.id, number: o.number, status: o.status, total: o.total + o.tip, createdAt: o.createdAt.toISOString() })),
    openBuyback: buyback
      ? { id: buyback.id, status: buyback.status, type: buyback.type, estimatedPayout: buyback.estimatedPayout, createdAt: buyback.createdAt.toISOString() }
      : null,
  };
});
