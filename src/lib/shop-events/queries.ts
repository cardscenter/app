import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getMaxOccupancy } from "@/lib/app-config";
import { listGames } from "@/lib/games-server";
import { ticketQrDataUrl } from "./tickets";
import {
  OCCUPYING_STATUSES,
  computeAvailability,
  parseAgeDivisions,
  divisionLabel,
  registrationWindow,
  canCancelWithRefund,
  type Availability,
  type RegistrationWindow,
} from "./config";
import { monthKey } from "./format";

/**
 * Leesqueries voor de winkel-events (Fase 3). Alles plain/serialiseerbaar
 * zodat pages het rechtstreeks aan client-componenten kunnen geven.
 */

export interface ShopEventListItem {
  id: string;
  title: string;
  typeName: string;
  typeKey: string;
  typeColor: string;
  game: string | null;
  gameName: string | null;
  startsAt: string; // ISO
  endsAt: string;
  price: number;
  status: string;
  coverImage: string | null;
  availability: Availability;
  window: RegistrationWindow;
  monthKey: string;
  minAge: number | null;
  countsForLeague: boolean;
}

export interface ShopEventFilters {
  game?: string | null;
  type?: string | null;
  /** Toon ook afgelopen events (admin/archief). */
  includePast?: boolean;
}

async function occupiedCounts(eventIds: string[], now: Date): Promise<Map<string, { occupied: number; waitlist: number }>> {
  const map = new Map<string, { occupied: number; waitlist: number }>();
  if (eventIds.length === 0) return map;
  const rows = await prisma.eventRegistration.findMany({
    where: { eventId: { in: eventIds }, status: { in: [...OCCUPYING_STATUSES, "WAITLIST"] } },
    select: { eventId: true, status: true, reservedUntil: true },
  });
  for (const r of rows) {
    const e = map.get(r.eventId) ?? { occupied: 0, waitlist: 0 };
    if (r.status === "WAITLIST") e.waitlist++;
    else if (r.status !== "RESERVED" || (r.reservedUntil && r.reservedUntil > now)) e.occupied++;
    map.set(r.eventId, e);
  }
  return map;
}

export const listShopEvents = cache(async function listShopEvents(filters: ShopEventFilters = {}): Promise<ShopEventListItem[]> {
  const now = new Date();
  const [events, games, maxOccupancy] = await Promise.all([
    prisma.shopEvent.findMany({
      where: {
        status: filters.includePast ? { in: ["PUBLISHED", "CANCELLED", "COMPLETED"] } : "PUBLISHED",
        ...(filters.includePast ? {} : { endsAt: { gte: now } }),
        ...(filters.game ? { game: filters.game } : {}),
        ...(filters.type ? { type: { key: filters.type } } : {}),
      },
      orderBy: { startsAt: "asc" },
      include: { type: { select: { name: true, key: true, color: true } } },
      take: 200,
    }),
    listGames(),
    getMaxOccupancy(),
  ]);
  const counts = await occupiedCounts(
    events.map((e) => e.id),
    now,
  );
  const gameName = (key: string | null) => (key ? (games.find((g) => g.key === key)?.name ?? key) : null);
  return events.map((e) => {
    const c = counts.get(e.id) ?? { occupied: 0, waitlist: 0 };
    return {
      id: e.id,
      title: e.title,
      typeName: e.type.name,
      typeKey: e.type.key,
      typeColor: e.type.color,
      game: e.game,
      gameName: gameName(e.game),
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      price: e.price,
      status: e.status,
      coverImage: e.coverImage,
      availability: computeAvailability({ eventCapacity: e.capacity, maxOccupancy, occupied: c.occupied, waitlistCount: c.waitlist }),
      window: registrationWindow(e, now),
      monthKey: monthKey(e.startsAt),
      minAge: e.minAge,
      countsForLeague: e.countsForLeague,
    };
  });
});

export interface ParticipantPreview {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  divisionLabel: string | null;
}

export interface MyRegistrationView {
  id: string;
  status: string;
  ticketCode: string;
  amount: number;
  reservedUntil: string | null;
  offerExpiresAt: string | null;
  waitlistPosition: number | null;
  divisionLabel: string | null;
  paymentStatus: string | null;
  checkoutUrl: string | null;
  canCancel: boolean;
  refundOnCancel: boolean;
}

export interface ShopEventDetail extends ShopEventListItem {
  description: string | null;
  registrationOpensAt: string | null;
  registrationDeadline: string | null;
  capacity: number | null;
  maxAge: number | null;
  underTwelveWithAdult: boolean;
  waitlistEnabled: boolean;
  countsForStampCard: boolean;
  showParticipants: boolean;
  cancellationHours: number;
  refundPolicy: string | null;
  cancelReason: string | null;
  divisions: Array<{ key: string; label: string }>;
  participants: ParticipantPreview[];
  participantCount: number;
  mine: MyRegistrationView | null;
}

export const getShopEventDetail = cache(async function getShopEventDetail(id: string, viewerId: string | null): Promise<ShopEventDetail | null> {
  const now = new Date();
  const e = await prisma.shopEvent.findUnique({
    where: { id },
    include: { type: { select: { name: true, key: true, color: true, ageDivisions: true } } },
  });
  if (!e) return null;
  const [games, maxOccupancy, counts, participantsRaw, mineRaw] = await Promise.all([
    listGames(),
    getMaxOccupancy(),
    occupiedCounts([e.id], now),
    e.showParticipants
      ? prisma.eventRegistration.findMany({
          where: { eventId: e.id, status: { in: ["CONFIRMED", "CHECKED_IN"] }, user: { showOnParticipantLists: true, deletedAt: null } },
          orderBy: { confirmedAt: "asc" },
          take: 60,
          select: { id: true, divisionKey: true, user: { select: { displayName: true, avatarUrl: true } } },
        })
      : Promise.resolve([]),
    viewerId
      ? prisma.eventRegistration.findUnique({
          where: { eventId_userId: { eventId: e.id, userId: viewerId } },
          include: { payment: { select: { status: true, checkoutUrl: true } } },
        })
      : Promise.resolve(null),
  ]);
  const rules = parseAgeDivisions(e.type.ageDivisions);
  const c = counts.get(e.id) ?? { occupied: 0, waitlist: 0 };
  const participantCount = await prisma.eventRegistration.count({ where: { eventId: e.id, status: { in: ["CONFIRMED", "CHECKED_IN"] } } });

  let mine: MyRegistrationView | null = null;
  if (mineRaw && !["CANCELLED", "REFUNDED", "EXPIRED", "NO_SHOW"].includes(mineRaw.status)) {
    const expiredReservation = mineRaw.status === "RESERVED" && (!mineRaw.reservedUntil || mineRaw.reservedUntil <= now);
    if (!expiredReservation) {
      const waitlistPosition =
        mineRaw.status === "WAITLIST"
          ? await prisma.eventRegistration.count({
              where: { eventId: e.id, status: "WAITLIST", waitlistJoinedAt: { lte: mineRaw.waitlistJoinedAt ?? now } },
            })
          : null;
      const cancellable = ["RESERVED", "CONFIRMED", "WAITLIST", "OFFERED"].includes(mineRaw.status) && e.startsAt > now;
      mine = {
        id: mineRaw.id,
        status: mineRaw.status,
        ticketCode: mineRaw.ticketCode,
        amount: mineRaw.amount,
        reservedUntil: mineRaw.reservedUntil?.toISOString() ?? null,
        offerExpiresAt: mineRaw.offerExpiresAt?.toISOString() ?? null,
        waitlistPosition,
        divisionLabel: divisionLabel(mineRaw.divisionKey, rules),
        paymentStatus: mineRaw.payment?.status ?? null,
        checkoutUrl: mineRaw.payment?.checkoutUrl ?? null,
        canCancel: cancellable,
        refundOnCancel: mineRaw.payment?.status === "PAID" && canCancelWithRefund(e, now),
      };
    }
  }

  return {
    id: e.id,
    title: e.title,
    typeName: e.type.name,
    typeKey: e.type.key,
    typeColor: e.type.color,
    game: e.game,
    gameName: e.game ? (games.find((g) => g.key === e.game)?.name ?? e.game) : null,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    price: e.price,
    status: e.status,
    coverImage: e.coverImage,
    availability: computeAvailability({ eventCapacity: e.capacity, maxOccupancy, occupied: c.occupied, waitlistCount: c.waitlist }),
    window: registrationWindow(e, now),
    monthKey: monthKey(e.startsAt),
    minAge: e.minAge,
    countsForLeague: e.countsForLeague,
    description: e.description,
    registrationOpensAt: e.registrationOpensAt?.toISOString() ?? null,
    registrationDeadline: e.registrationDeadline?.toISOString() ?? null,
    capacity: e.capacity,
    maxAge: e.maxAge,
    underTwelveWithAdult: e.underTwelveWithAdult,
    waitlistEnabled: e.waitlistEnabled,
    countsForStampCard: e.countsForStampCard,
    showParticipants: e.showParticipants,
    cancellationHours: e.cancellationHours,
    refundPolicy: e.refundPolicy,
    cancelReason: e.cancelReason,
    divisions: rules.map((r) => ({ key: r.key, label: r.label })),
    participants: participantsRaw.map((p) => ({
      id: p.id,
      displayName: p.user.displayName,
      avatarUrl: p.user.avatarUrl,
      divisionLabel: divisionLabel(p.divisionKey, rules),
    })),
    participantCount,
    mine,
  };
});

export interface TicketView {
  id: string;
  status: string;
  ticketCode: string;
  amount: number;
  divisionLabel: string | null;
  qrDataUrl: string | null;
  canCancel: boolean;
  refundOnCancel: boolean;
  reservedUntil: string | null;
  offerExpiresAt: string | null;
  checkoutUrl: string | null;
  event: {
    id: string;
    title: string;
    typeName: string;
    typeColor: string;
    startsAt: string;
    endsAt: string;
    status: string;
    cancellationHours: number;
  };
}

export async function getMyTickets(userId: string): Promise<{ upcoming: TicketView[]; past: TicketView[] }> {
  const now = new Date();
  const rows = await prisma.eventRegistration.findMany({
    where: { userId, status: { notIn: ["EXPIRED"] } },
    include: {
      event: { include: { type: { select: { name: true, color: true, ageDivisions: true } } } },
      payment: { select: { status: true, checkoutUrl: true } },
    },
    orderBy: { event: { startsAt: "asc" } },
    take: 100,
  });
  const views: TicketView[] = [];
  for (const r of rows) {
    if (r.status === "RESERVED" && (!r.reservedUntil || r.reservedUntil <= now)) continue;
    const rules = parseAgeDivisions(r.event.type.ageDivisions);
    const active = r.status === "CONFIRMED" || r.status === "CHECKED_IN";
    views.push({
      id: r.id,
      status: r.status,
      ticketCode: r.ticketCode,
      amount: r.amount,
      divisionLabel: divisionLabel(r.divisionKey, rules),
      qrDataUrl: active && r.event.status === "PUBLISHED" ? await ticketQrDataUrl(r.ticketCode, r.qrSecret) : null,
      canCancel: ["RESERVED", "CONFIRMED", "WAITLIST", "OFFERED"].includes(r.status) && r.event.startsAt > now && r.event.status === "PUBLISHED",
      refundOnCancel: r.payment?.status === "PAID" && canCancelWithRefund(r.event, now),
      reservedUntil: r.reservedUntil?.toISOString() ?? null,
      offerExpiresAt: r.offerExpiresAt?.toISOString() ?? null,
      checkoutUrl: r.payment?.checkoutUrl ?? null,
      event: {
        id: r.event.id,
        title: r.event.title,
        typeName: r.event.type.name,
        typeColor: r.event.type.color,
        startsAt: r.event.startsAt.toISOString(),
        endsAt: r.event.endsAt.toISOString(),
        status: r.event.status,
        cancellationHours: r.event.cancellationHours,
      },
    });
  }
  return {
    upcoming: views.filter((v) => new Date(v.event.endsAt) >= now),
    past: views.filter((v) => new Date(v.event.endsAt) < now).reverse(),
  };
}

export async function getTicketByCode(userId: string, code: string): Promise<TicketView | null> {
  const all = await getMyTickets(userId);
  return [...all.upcoming, ...all.past].find((t) => t.ticketCode === code) ?? null;
}
