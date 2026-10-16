import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createNotification } from "@/actions/notification";
import { getBookingEligibility } from "@/lib/event-eligibility";
import { ageOn, needsSupervision } from "@/lib/age";
import { getMaxOccupancy } from "@/lib/app-config";
import { createProviderPayment, fetchProviderPayment, refundProviderPayment } from "@/lib/mollie";
import { newQrSecret, verifyTicketSignature } from "./tickets";
import { onFoodOrderPaymentStatus } from "@/lib/food/orders";
import { onCheckIn } from "@/lib/community/loyalty";
import { onBuybackReturnPaymentStatus } from "@/lib/buyback/returns";
import {
  ACTIVE_TICKET_STATUSES,
  DEFAULT_EVENT_TYPES,
  OCCUPYING_STATUSES,
  RESERVATION_MINUTES,
  WAITLIST_OFFER_HOURS,
  TERMINAL_STATUSES,
  ageAllowed,
  canCancelWithRefund,
  computeAvailability,
  divisionKeyFor,
  generateTicketCode,
  isWithinCheckInWindow,
  mapProviderStatus,
  parseAgeDivisions,
  registrationWindow,
  type Availability,
  type RegistrationStatus,
} from "./config";
import { formatEventDate, formatEventTime, formatPrice } from "./format";

/**
 * Statusmachine voor inschrijvingen, betalingen en wachtlijst (Fase 3).
 * Alle overgangen zijn race-safe via `updateMany WHERE status = verwacht`,
 * zodat een webhook, een cron-tick en een klik van de speler elkaar niet
 * dubbel kunnen uitvoeren. Server actions zijn dunne wrappers hieromheen.
 */

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------- event-types

/** Vooringevulde event-types één keer aanmaken (lazy, net als GameOption). */
export async function ensureEventTypes(): Promise<void> {
  const count = await prisma.eventType.count();
  if (count > 0) return;
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
}

// ---------------------------------------------------------------- availability

function occupyingWhere(eventId: string, now: Date): Prisma.EventRegistrationWhereInput {
  return {
    eventId,
    OR: [
      { status: { in: OCCUPYING_STATUSES.filter((s) => s !== "RESERVED") as string[] } },
      { status: "RESERVED", reservedUntil: { gt: now } },
    ],
  };
}

/**
 * Beschikbaarheid. Binnen een `$transaction` ALTIJD `maxOccupancy` meegeven
 * (vooraf opgehaald): een query via de globale client terwijl de transactie
 * de SQLite-lock houdt, blokkeert tot de transactie verloopt.
 */
export async function getEventAvailability(
  event: { id: string; capacity: number | null },
  db: Tx | typeof prisma = prisma,
  now: Date = new Date(),
  maxOccupancy?: number | null,
): Promise<Availability> {
  const limit = maxOccupancy === undefined ? await getMaxOccupancy() : maxOccupancy;
  const [occupied, waitlistCount] = await Promise.all([
    db.eventRegistration.count({ where: occupyingWhere(event.id, now) }),
    db.eventRegistration.count({ where: { eventId: event.id, status: "WAITLIST" } }),
  ]);
  return computeAvailability({ eventCapacity: event.capacity, maxOccupancy: limit, occupied, waitlistCount });
}

// ---------------------------------------------------------------- notifications

const eventSelectForNotify = { id: true, title: true, startsAt: true, endsAt: true, price: true } as const;
type EventForNotify = { id: string; title: string; startsAt: Date; endsAt: Date; price: number };

function when(e: EventForNotify): string {
  return `${formatEventDate(e.startsAt)} om ${formatEventTime(e.startsAt)}`;
}

async function notifyTicket(userId: string, e: EventForNotify, ticketCode: string) {
  await createNotification(
    userId,
    "EVENT_TICKET",
    `Je ticket voor ${e.title}`,
    `Je staat ingeschreven voor ${e.title} op ${when(e)}. Je ticketcode is ${ticketCode}. Laat de QR-code op je ticket zien bij de ingang.`,
    `/dashboard/tickets/${ticketCode}`,
  );
}

async function notifyWaitlistOffer(userId: string, e: EventForNotify, expiresAt: Date) {
  await createNotification(
    userId,
    "EVENT_WAITLIST_OFFER",
    `Er is een plek vrij voor ${e.title}`,
    `Je stond op de wachtlijst en er is een plek vrijgekomen voor ${e.title} op ${when(e)}. ${
      e.price > 0 ? `Betaal ${formatPrice(e.price)} vóór ${formatEventDate(expiresAt)} ${formatEventTime(expiresAt)}` : `Bevestig je plek vóór ${formatEventDate(expiresAt)} ${formatEventTime(expiresAt)}`
    }, anders gaat de plek naar de volgende.`,
    `/evenementen/${e.id}`,
  );
}

async function notifyCancelled(userId: string, e: EventForNotify, refunded: boolean, byShop: boolean, reason?: string | null) {
  const title = byShop ? `${e.title} is geannuleerd` : `Je inschrijving voor ${e.title} is geannuleerd`;
  const body = [
    byShop ? `Het event op ${when(e)} gaat niet door.${reason ? ` Reden: ${reason}` : ""}` : `Je inschrijving voor ${when(e)} is geannuleerd.`,
    refunded ? "Het bedrag wordt teruggestort op de rekening waarmee je betaald hebt (meestal binnen een paar werkdagen)." : "",
  ]
    .filter(Boolean)
    .join(" ");
  await createNotification(userId, byShop ? "EVENT_CANCELLED" : "EVENT_REGISTRATION_CANCELLED", title, body, `/evenementen/${e.id}`);
}

// ---------------------------------------------------------------- registreren

export type RegisterOutcome =
  | { kind: "confirmed"; registrationId: string; ticketCode: string }
  | { kind: "payment"; registrationId: string; checkoutUrl: string }
  | { kind: "waitlist"; registrationId: string; position: number }
  | { kind: "full"; waitlistAvailable: boolean }
  | { error: string; reason?: "email" | "dob" | "guardian" | "deleted" | "age" | "supervision" | "window" | "duplicate" };

async function uniqueTicketCode(db: Tx | typeof prisma): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateTicketCode();
    const exists = await db.eventRegistration.findUnique({ where: { ticketCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Kon geen unieke ticketcode genereren");
}

/**
 * Inschrijven (of op de wachtlijst). Gratis event → direct CONFIRMED met
 * ticket; betaald → RESERVED (10 min) + Mollie-checkout.
 */
export async function registerForEvent(args: {
  eventId: string;
  userId: string;
  supervisedByAdult: boolean;
  joinWaitlist: boolean;
  locale: string;
}): Promise<RegisterOutcome> {
  const now = new Date();
  const event = await prisma.shopEvent.findUnique({
    where: { id: args.eventId },
    include: { type: { select: { ageDivisions: true, name: true } } },
  });
  if (!event) return { error: "Event niet gevonden" };

  const window = registrationWindow(event, now);
  if (window !== "open") {
    const msg =
      window === "not-yet"
        ? "De inschrijving is nog niet open."
        : window === "closed"
          ? "De inschrijving is gesloten."
          : window === "started"
            ? "Dit event is al begonnen."
            : "Dit event is niet beschikbaar.";
    return { error: msg, reason: "window" };
  }

  const eligibility = await getBookingEligibility(args.userId);
  if (!eligibility.ok) return { error: eligibility.error, reason: eligibility.reason };

  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { dateOfBirth: true, displayName: true },
  });
  if (!user?.dateOfBirth) return { error: "Vul eerst je geboortedatum in.", reason: "dob" };

  const age = ageOn(user.dateOfBirth, event.startsAt);
  if (!ageAllowed(age, event)) {
    return {
      error:
        event.minAge !== null && age < event.minAge
          ? `Dit event is vanaf ${event.minAge} jaar.`
          : `Dit event is tot en met ${event.maxAge} jaar.`,
      reason: "age",
    };
  }
  if (needsSupervision(user.dateOfBirth, event.startsAt)) {
    if (!event.underTwelveWithAdult) return { error: "Dit event is niet toegankelijk onder de 12 jaar.", reason: "age" };
    if (!args.supervisedByAdult) {
      return { error: "Onder de 12 jaar kun je alleen meedoen met begeleiding van een volwassene. Vink dat aan om door te gaan.", reason: "supervision" };
    }
  }

  const divisionKey = divisionKeyFor(user.dateOfBirth, parseAgeDivisions(event.type.ageDivisions));

  // Bestaande rij? Verlopen reservering eerst opruimen; actieve rij = dubbel.
  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: args.userId } },
  });
  if (existing) {
    if (existing.status === "RESERVED" && existing.reservedUntil && existing.reservedUntil <= now) {
      await prisma.eventRegistration.updateMany({ where: { id: existing.id, status: "RESERVED" }, data: { status: "EXPIRED" } });
      existing.status = "EXPIRED";
    }
    if (!TERMINAL_STATUSES.includes(existing.status as RegistrationStatus)) {
      return { error: "Je staat al ingeschreven voor dit event.", reason: "duplicate" };
    }
  }

  const maxOccupancy = await getMaxOccupancy();
  const outcome = await prisma.$transaction(async (tx) => {
    const availability = await getEventAvailability(event, tx, now, maxOccupancy);
    const base = {
      divisionKey,
      supervisedByAdult: args.supervisedByAdult,
      amount: event.price,
      paymentId: null,
      reservedUntil: null,
      waitlistJoinedAt: null,
      offerExpiresAt: null,
      confirmedAt: null,
      checkedInAt: null,
      checkedInById: null,
      cancelledAt: null,
      refundedAt: null,
    };

    if (availability.full) {
      if (!event.waitlistEnabled) return { kind: "full", waitlistAvailable: false } as const;
      if (!args.joinWaitlist) return { kind: "full", waitlistAvailable: true } as const;
      const row = await upsertRegistration(tx, existing?.id ?? null, {
        eventId: event.id,
        userId: args.userId,
        ...base,
        status: "WAITLIST",
        waitlistJoinedAt: now,
        ticketCode: existing?.ticketCode ?? (await uniqueTicketCode(tx)),
        qrSecret: existing?.qrSecret ?? newQrSecret(),
      });
      const position = await tx.eventRegistration.count({
        where: { eventId: event.id, status: "WAITLIST", waitlistJoinedAt: { lte: now } },
      });
      return { kind: "waitlist", registrationId: row.id, position } as const;
    }

    const ticketCode = await uniqueTicketCode(tx);
    const qrSecret = newQrSecret();
    if (event.price <= 0) {
      const row = await upsertRegistration(tx, existing?.id ?? null, {
        eventId: event.id,
        userId: args.userId,
        ...base,
        status: "CONFIRMED",
        confirmedAt: now,
        ticketCode,
        qrSecret,
      });
      return { kind: "confirmed", registrationId: row.id, ticketCode } as const;
    }

    const payment = await tx.payment.create({
      data: {
        purpose: "EVENT_REGISTRATION",
        amount: event.price,
        description: `${event.title} (${formatEventDate(event.startsAt)})`,
        userId: args.userId,
        metadata: JSON.stringify({ eventId: event.id }),
      },
    });
    const row = await upsertRegistration(tx, existing?.id ?? null, {
      eventId: event.id,
      userId: args.userId,
      ...base,
      status: "RESERVED",
      reservedUntil: new Date(now.getTime() + RESERVATION_MINUTES * 60_000),
      paymentId: payment.id,
      ticketCode,
      qrSecret,
    });
    return { kind: "reserved", registrationId: row.id, paymentId: payment.id } as const;
  });

  if ("kind" in outcome && outcome.kind === "confirmed") {
    await notifyTicket(args.userId, event, outcome.ticketCode);
    return outcome;
  }
  if ("kind" in outcome && outcome.kind === "reserved") {
    const checkout = await attachProviderPayment({
      paymentId: outcome.paymentId,
      registrationId: outcome.registrationId,
      eventId: event.id,
      eventTitle: event.title,
      amount: event.price,
      locale: args.locale,
    });
    if ("error" in checkout) return checkout;
    return { kind: "payment", registrationId: outcome.registrationId, checkoutUrl: checkout.checkoutUrl };
  }
  return outcome as RegisterOutcome;
}

async function upsertRegistration(
  tx: Tx,
  existingId: string | null,
  data: Prisma.EventRegistrationUncheckedCreateInput,
) {
  if (existingId) {
    const { eventId: _e, userId: _u, ...rest } = data;
    void _e;
    void _u;
    return tx.eventRegistration.update({ where: { id: existingId }, data: rest });
  }
  return tx.eventRegistration.create({ data });
}

/** Mollie-betaling aanmaken en aan de Payment-rij hangen. Bij een fout: reservering vrijgeven. */
async function attachProviderPayment(args: {
  paymentId: string;
  registrationId: string;
  eventId: string;
  eventTitle: string;
  amount: number;
  locale: string;
}): Promise<{ checkoutUrl: string } | { error: string }> {
  try {
    const created = await createProviderPayment({
      paymentId: args.paymentId,
      amount: args.amount,
      description: `Cards Center: ${args.eventTitle}`.slice(0, 250),
      redirectPath: `/${args.locale}/evenementen/${args.eventId}/bedankt?r=${args.registrationId}`,
      metadata: { registrationId: args.registrationId, eventId: args.eventId },
      locale: args.locale,
    });
    await prisma.payment.update({
      where: { id: args.paymentId },
      data: { provider: created.provider, providerPaymentId: created.providerPaymentId, checkoutUrl: created.checkoutUrl, status: mapProviderStatus(created.status) },
    });
    return { checkoutUrl: created.checkoutUrl };
  } catch (err) {
    console.error("[shop-events] betaling aanmaken mislukt", err);
    await prisma.payment.update({ where: { id: args.paymentId }, data: { status: "FAILED", failedAt: new Date() } }).catch(() => {});
    await prisma.eventRegistration.updateMany({
      where: { id: args.registrationId, status: { in: ["RESERVED"] } },
      data: { status: "EXPIRED", paymentId: null },
    });
    await promoteWaitlist(args.eventId);
    return { error: "De betaling kon niet gestart worden. Probeer het zo nog eens." };
  }
}

/**
 * Nieuwe betaalpoging voor een bestaande inschrijving: na een mislukte
 * betaling (RESERVED, nog binnen de 10 min) of bij een wachtlijst-aanbod
 * (OFFERED). Gratis event + OFFERED → direct bevestigen.
 */
export async function startPaymentForRegistration(args: {
  registrationId: string;
  userId: string;
  locale: string;
}): Promise<{ kind: "payment"; checkoutUrl: string } | { kind: "confirmed"; ticketCode: string } | { error: string }> {
  const now = new Date();
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: args.registrationId },
    include: { event: true, payment: true },
  });
  if (!reg || reg.userId !== args.userId) return { error: "Inschrijving niet gevonden" };
  if (reg.event.status !== "PUBLISHED" || reg.event.startsAt <= now) return { error: "Dit event is niet meer beschikbaar." };

  if (reg.status === "OFFERED") {
    if (!reg.offerExpiresAt || reg.offerExpiresAt <= now) return { error: "Het aanbod is verlopen." };
  } else if (reg.status === "RESERVED") {
    if (!reg.reservedUntil || reg.reservedUntil <= now) return { error: "Je reservering is verlopen. Schrijf je opnieuw in." };
    if (reg.payment && (reg.payment.status === "OPEN" || reg.payment.status === "PENDING") && reg.payment.checkoutUrl) {
      return { kind: "payment", checkoutUrl: reg.payment.checkoutUrl };
    }
  } else {
    return { error: "Deze inschrijving wacht niet op een betaling." };
  }

  if (reg.event.price <= 0) {
    const r = await prisma.eventRegistration.updateMany({
      where: { id: reg.id, status: reg.status },
      data: { status: "CONFIRMED", confirmedAt: now, offerExpiresAt: null, reservedUntil: null },
    });
    if (r.count !== 1) return { error: "Probeer het opnieuw." };
    await notifyTicket(reg.userId, reg.event, reg.ticketCode);
    return { kind: "confirmed", ticketCode: reg.ticketCode };
  }

  const payment = await prisma.payment.create({
    data: {
      purpose: "EVENT_REGISTRATION",
      amount: reg.event.price,
      description: `${reg.event.title} (${formatEventDate(reg.event.startsAt)})`,
      userId: reg.userId,
      metadata: JSON.stringify({ eventId: reg.eventId, registrationId: reg.id }),
    },
  });
  await prisma.eventRegistration.update({ where: { id: reg.id }, data: { paymentId: payment.id, amount: reg.event.price } });
  const checkout = await attachProviderPaymentKeepStatus({
    paymentId: payment.id,
    registrationId: reg.id,
    eventId: reg.eventId,
    eventTitle: reg.event.title,
    amount: reg.event.price,
    locale: args.locale,
  });
  if ("error" in checkout) return checkout;
  return { kind: "payment", checkoutUrl: checkout.checkoutUrl };
}

/** Variant voor OFFERED: bij een fout blijft het aanbod staan (speler kan opnieuw proberen). */
async function attachProviderPaymentKeepStatus(
  args: Parameters<typeof attachProviderPayment>[0],
): Promise<{ checkoutUrl: string } | { error: string }> {
  try {
    const created = await createProviderPayment({
      paymentId: args.paymentId,
      amount: args.amount,
      description: `Cards Center: ${args.eventTitle}`.slice(0, 250),
      redirectPath: `/${args.locale}/evenementen/${args.eventId}/bedankt?r=${args.registrationId}`,
      metadata: { registrationId: args.registrationId, eventId: args.eventId },
      locale: args.locale,
    });
    await prisma.payment.update({
      where: { id: args.paymentId },
      data: { provider: created.provider, providerPaymentId: created.providerPaymentId, checkoutUrl: created.checkoutUrl, status: mapProviderStatus(created.status) },
    });
    return { checkoutUrl: created.checkoutUrl };
  } catch (err) {
    console.error("[shop-events] betaling aanmaken mislukt", err);
    await prisma.payment.update({ where: { id: args.paymentId }, data: { status: "FAILED", failedAt: new Date() } }).catch(() => {});
    return { error: "De betaling kon niet gestart worden. Probeer het zo nog eens." };
  }
}

// ---------------------------------------------------------------- betaalstatus

/**
 * Betaalstatus verwerken (webhook, terugkeer-pagina, simulatie). Idempotent:
 * een PAID-betaling verandert nooit meer door een latere niet-PAID-status, en
 * de inschrijving wordt maar één keer bevestigd (updateMany-gate).
 */
export async function applyPaymentStatus(args: {
  paymentId?: string;
  providerPaymentId?: string;
  providerStatus: string;
  paidAt?: Date | null;
  source: "webhook" | "return" | "simulate" | "cron";
}): Promise<{ ok: true; paymentStatus: string; registrationStatus: string | null } | { error: string }> {
  const now = new Date();
  const payment = await prisma.payment.findFirst({
    where: args.paymentId ? { id: args.paymentId } : { providerPaymentId: args.providerPaymentId },
    include: { registration: { include: { event: { select: eventSelectForNotify } } } },
  });
  if (!payment) return { error: "Betaling niet gevonden" };

  const next = mapProviderStatus(args.providerStatus);
  await prisma.payment.update({
    where: { id: payment.id },
    data: args.source === "webhook" ? { webhookCount: { increment: 1 }, lastWebhookAt: now } : {},
  });

  // Eten bestellen (Fase 4): eigen afhandeling, zelfde idempotente betaalstatus.
  if (payment.purpose === "FOOD_ORDER") {
    if (payment.status === "PAID" || payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED" || next === payment.status) {
      return { ok: true, paymentStatus: payment.status, registrationStatus: null };
    }
    if (next === "PAID") {
      const claimed = await prisma.payment.updateMany({
        where: { id: payment.id, status: { in: ["OPEN", "PENDING", "FAILED", "CANCELED", "EXPIRED"] } },
        data: { status: "PAID", paidAt: args.paidAt ?? now },
      });
      if (claimed.count === 1) await onFoodOrderPaymentStatus(payment.id, "PAID", now);
      return { ok: true, paymentStatus: "PAID", registrationStatus: null };
    }
    await prisma.payment.updateMany({ where: { id: payment.id, status: { in: ["OPEN", "PENDING"] } }, data: { status: next, failedAt: next === "PENDING" ? null : now } });
    await onFoodOrderPaymentStatus(payment.id, next, now);
    return { ok: true, paymentStatus: next, registrationStatus: null };
  }

  // Retourkosten inkoop (Fase 6): zelfde idempotente betaalstatus, eigen vervolg.
  if (payment.purpose === "BUYBACK_RETURN") {
    if (payment.status === "PAID" || payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED" || next === payment.status) {
      return { ok: true, paymentStatus: payment.status, registrationStatus: null };
    }
    if (next === "PAID") {
      const claimed = await prisma.payment.updateMany({
        where: { id: payment.id, status: { in: ["OPEN", "PENDING", "FAILED", "CANCELED", "EXPIRED"] } },
        data: { status: "PAID", paidAt: args.paidAt ?? now },
      });
      if (claimed.count === 1) await onBuybackReturnPaymentStatus(payment.id, "PAID", now);
      return { ok: true, paymentStatus: "PAID", registrationStatus: null };
    }
    await prisma.payment.updateMany({ where: { id: payment.id, status: { in: ["OPEN", "PENDING"] } }, data: { status: next, failedAt: next === "PENDING" ? null : now } });
    return { ok: true, paymentStatus: next, registrationStatus: null };
  }

  // Al betaald (of terugbetaald): niets meer veranderen, alleen loggen.
  if (payment.status === "PAID" || payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") {
    return { ok: true, paymentStatus: payment.status, registrationStatus: payment.registration?.status ?? null };
  }
  if (next === payment.status) {
    return { ok: true, paymentStatus: payment.status, registrationStatus: payment.registration?.status ?? null };
  }

  const reg = payment.registration;

  if (next === "PAID") {
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: { in: ["OPEN", "PENDING", "FAILED", "CANCELED", "EXPIRED"] } },
      data: { status: "PAID", paidAt: args.paidAt ?? now },
    });
    if (claimed.count !== 1 || !reg) return { ok: true, paymentStatus: "PAID", registrationStatus: reg?.status ?? null };

    // Normale weg: RESERVED/OFFERED → CONFIRMED.
    const confirmed = await prisma.eventRegistration.updateMany({
      where: { id: reg.id, status: { in: ["RESERVED", "OFFERED"] } },
      data: { status: "CONFIRMED", confirmedAt: now, reservedUntil: null, offerExpiresAt: null, paymentId: payment.id },
    });
    if (confirmed.count === 1) {
      await notifyTicket(reg.userId, reg.event, reg.ticketCode);
      return { ok: true, paymentStatus: "PAID", registrationStatus: "CONFIRMED" };
    }

    // Betaling kwam ná het verlopen van de reservering/het aanbod: alsnog een
    // plek proberen te pakken; lukt dat niet, dan automatisch terugbetalen.
    if (reg.status === "EXPIRED") {
      const maxOccupancy = await getMaxOccupancy();
      const got = await prisma.$transaction(async (tx) => {
        const ev = await tx.shopEvent.findUnique({ where: { id: reg.eventId }, select: { id: true, capacity: true, status: true, startsAt: true } });
        if (!ev || ev.status !== "PUBLISHED" || ev.startsAt <= now) return false;
        const availability = await getEventAvailability(ev, tx, now, maxOccupancy);
        if (availability.full) return false;
        const r = await tx.eventRegistration.updateMany({
          where: { id: reg.id, status: "EXPIRED" },
          data: { status: "CONFIRMED", confirmedAt: now, paymentId: payment.id },
        });
        return r.count === 1;
      });
      if (got) {
        await notifyTicket(reg.userId, reg.event, reg.ticketCode);
        return { ok: true, paymentStatus: "PAID", registrationStatus: "CONFIRMED" };
      }
      await refundPayment(payment.id, "Plek was al vergeven toen de betaling binnenkwam");
      await prisma.eventRegistration.updateMany({ where: { id: reg.id }, data: { status: "REFUNDED", refundedAt: now, paymentId: payment.id } });
      await notifyCancelled(reg.userId, reg.event, true, false);
      return { ok: true, paymentStatus: "REFUNDED", registrationStatus: "REFUNDED" };
    }
    return { ok: true, paymentStatus: "PAID", registrationStatus: reg.status };
  }

  // Niet-geslaagde eindstatus: betaling bijwerken; reservering vrijgeven.
  await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: ["OPEN", "PENDING"] } },
    data: { status: next, failedAt: next === "PENDING" ? null : now },
  });
  if (reg && next !== "PENDING" && next !== "OPEN") {
    if (reg.status === "RESERVED") {
      await prisma.eventRegistration.updateMany({
        where: { id: reg.id, status: "RESERVED" },
        data: { status: "EXPIRED", paymentId: null },
      });
      await promoteWaitlist(reg.eventId);
      return { ok: true, paymentStatus: next, registrationStatus: "EXPIRED" };
    }
    // OFFERED: aanbod blijft staan tot offerExpiresAt; speler mag opnieuw betalen.
    if (reg.status === "OFFERED") {
      await prisma.eventRegistration.updateMany({ where: { id: reg.id, status: "OFFERED" }, data: { paymentId: null } });
    }
  }
  return { ok: true, paymentStatus: next, registrationStatus: reg?.status ?? null };
}

/** Status bij Mollie ophalen en verwerken (terugkeer-pagina / handmatige sync). */
export async function syncPaymentFromProvider(paymentId: string, source: "return" | "cron" = "return") {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { providerPaymentId: true, status: true } });
  if (!payment?.providerPaymentId) return null;
  const remote = await fetchProviderPayment(payment.providerPaymentId);
  if (!remote) return null;
  return applyPaymentStatus({ paymentId, providerStatus: remote.status, paidAt: remote.paidAt, source });
}

/** Volledige terugbetaling van een PAID-betaling (idempotent). */
export async function refundPayment(paymentId: string, description: string): Promise<{ refunded: boolean }> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PAID" || !payment.providerPaymentId) return { refunded: false };
  const claimed = await prisma.payment.updateMany({ where: { id: paymentId, status: "PAID" }, data: { status: "REFUNDED" } });
  if (claimed.count !== 1) return { refunded: false };
  try {
    const r = await refundProviderPayment({ providerPaymentId: payment.providerPaymentId, amount: payment.amount, description });
    await prisma.payment.update({ where: { id: paymentId }, data: { refundedAmount: payment.amount, providerRefundId: r.refundId } });
    return { refunded: true };
  } catch (err) {
    console.error("[shop-events] terugbetaling mislukt", err);
    // Terugdraaien zodat een admin het opnieuw kan proberen.
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "PAID" } });
    throw err;
  }
}

// ---------------------------------------------------------------- wachtlijst

/**
 * Vrijgekomen plekken aanbieden aan de wachtlijst (oudste eerst). Betaald
 * event → OFFERED met 24u-deadline; gratis event → direct CONFIRMED.
 */
export async function promoteWaitlist(eventId: string): Promise<number> {
  const now = new Date();
  let promoted = 0;
  const maxOccupancy = await getMaxOccupancy();
  for (let i = 0; i < 50; i++) {
    const result = await prisma.$transaction(async (tx) => {
      const ev = await tx.shopEvent.findUnique({
        where: { id: eventId },
        select: { id: true, capacity: true, status: true, startsAt: true, endsAt: true, title: true, price: true, waitlistEnabled: true },
      });
      if (!ev || ev.status !== "PUBLISHED" || ev.startsAt <= now) return null;
      const availability = await getEventAvailability(ev, tx, now, maxOccupancy);
      if (availability.full) return null;
      const next = await tx.eventRegistration.findFirst({
        where: { eventId, status: "WAITLIST" },
        orderBy: [{ waitlistJoinedAt: "asc" }, { createdAt: "asc" }],
      });
      if (!next) return null;
      const offerExpiresAt = new Date(now.getTime() + WAITLIST_OFFER_HOURS * 3600_000);
      const data =
        ev.price <= 0
          ? { status: "CONFIRMED", confirmedAt: now, offerExpiresAt: null }
          : { status: "OFFERED", offerExpiresAt };
      const r = await tx.eventRegistration.updateMany({ where: { id: next.id, status: "WAITLIST" }, data });
      if (r.count !== 1) return null;
      return { reg: next, ev, offerExpiresAt, free: ev.price <= 0 };
    });
    if (!result) break;
    promoted++;
    if (result.free) await notifyTicket(result.reg.userId, result.ev, result.reg.ticketCode);
    else await notifyWaitlistOffer(result.reg.userId, result.ev, result.offerExpiresAt);
  }
  return promoted;
}

/** Cron: verlopen reserveringen (RESERVED > 10 min) vrijgeven + wachtlijst. */
export async function expireReservations(now: Date = new Date()): Promise<{ expired: number; promoted: number }> {
  const stale = await prisma.eventRegistration.findMany({
    where: { status: "RESERVED", reservedUntil: { lt: now } },
    select: { id: true, eventId: true },
  });
  let expired = 0;
  const events = new Set<string>();
  for (const s of stale) {
    const r = await prisma.eventRegistration.updateMany({
      where: { id: s.id, status: "RESERVED", reservedUntil: { lt: now } },
      data: { status: "EXPIRED" },
    });
    if (r.count === 1) {
      expired++;
      events.add(s.eventId);
    }
  }
  let promoted = 0;
  for (const eventId of events) promoted += await promoteWaitlist(eventId);
  return { expired, promoted };
}

/** Cron: verlopen wachtlijst-aanbiedingen → EXPIRED, volgende kandidaat. */
export async function expireWaitlistOffers(now: Date = new Date()): Promise<{ expired: number; promoted: number }> {
  const stale = await prisma.eventRegistration.findMany({
    where: { status: "OFFERED", offerExpiresAt: { lt: now } },
    include: { event: { select: eventSelectForNotify } },
  });
  let expired = 0;
  const events = new Set<string>();
  for (const s of stale) {
    const r = await prisma.eventRegistration.updateMany({
      where: { id: s.id, status: "OFFERED", offerExpiresAt: { lt: now } },
      data: { status: "EXPIRED", paymentId: null },
    });
    if (r.count === 1) {
      expired++;
      events.add(s.eventId);
      await createNotification(
        s.userId,
        "EVENT_WAITLIST_EXPIRED",
        `Je plek voor ${s.event.title} is vervallen`,
        `Je hebt niet op tijd betaald of bevestigd, dus de plek is naar de volgende op de wachtlijst gegaan. Je kunt je opnieuw op de wachtlijst zetten.`,
        `/evenementen/${s.eventId}`,
      );
    }
  }
  let promoted = 0;
  for (const eventId of events) promoted += await promoteWaitlist(eventId);
  return { expired, promoted };
}

// ---------------------------------------------------------------- annuleren

/**
 * Inschrijving annuleren door de speler (binnen het annuleringsvenster met
 * terugbetaling) of door staff/admin (altijd met terugbetaling als betaald).
 */
export async function cancelRegistration(args: {
  registrationId: string;
  actorUserId: string;
  byStaff: boolean;
  reason?: string | null;
}): Promise<{ ok: true; refunded: boolean; status: RegistrationStatus } | { error: string }> {
  const now = new Date();
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: args.registrationId },
    include: { event: true, payment: true },
  });
  if (!reg) return { error: "Inschrijving niet gevonden" };
  if (!args.byStaff && reg.userId !== args.actorUserId) return { error: "Geen toegang" };
  const cancellable: RegistrationStatus[] = ["RESERVED", "CONFIRMED", "WAITLIST", "OFFERED"];
  if (!cancellable.includes(reg.status as RegistrationStatus)) return { error: "Deze inschrijving kan niet meer geannuleerd worden." };
  if (!args.byStaff && reg.event.startsAt <= now) return { error: "Het event is al begonnen." };

  const paid = reg.payment?.status === "PAID";
  const refundAllowed = paid && (args.byStaff || canCancelWithRefund(reg.event, now));
  const newStatus: RegistrationStatus = refundAllowed ? "REFUNDED" : "CANCELLED";

  const r = await prisma.eventRegistration.updateMany({
    where: { id: reg.id, status: reg.status },
    data: {
      status: newStatus,
      cancelledAt: now,
      refundedAt: refundAllowed ? now : null,
      reservedUntil: null,
      offerExpiresAt: null,
      note: args.reason ? `${reg.note ? reg.note + "\n" : ""}Annulering: ${args.reason}` : reg.note,
    },
  });
  if (r.count !== 1) return { error: "Probeer het opnieuw." };

  let refunded = false;
  if (refundAllowed && reg.payment) {
    try {
      refunded = (await refundPayment(reg.payment.id, `Annulering ${reg.event.title}`)).refunded;
    } catch {
      // Status blijft REFUNDED-bedoeld; admin ziet de betaling nog als PAID en kan opnieuw proberen.
      refunded = false;
    }
  } else if (paid && reg.payment && !refundAllowed) {
    // Betaald maar buiten het venster: geld blijft bij de winkel (beleid).
    refunded = false;
  }

  await notifyCancelled(reg.userId, reg.event, refunded, args.byStaff && args.actorUserId !== reg.userId, args.reason);
  await promoteWaitlist(reg.eventId);
  return { ok: true, refunded, status: newStatus };
}

/** Heel event annuleren: alle actieve inschrijvingen annuleren + terugbetalen. */
export async function cancelWholeEvent(args: { eventId: string; adminId: string; reason: string }): Promise<{ cancelled: number; refunded: number }> {
  const now = new Date();
  const flipped = await prisma.shopEvent.updateMany({
    where: { id: args.eventId, status: { in: ["DRAFT", "PUBLISHED"] } },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: args.reason },
  });
  if (flipped.count !== 1) return { cancelled: 0, refunded: 0 };

  const regs = await prisma.eventRegistration.findMany({
    where: { eventId: args.eventId, status: { in: ["RESERVED", "CONFIRMED", "WAITLIST", "OFFERED"] } },
    include: { event: { select: eventSelectForNotify }, payment: true },
  });
  let cancelled = 0;
  let refunded = 0;
  for (const reg of regs) {
    const paid = reg.payment?.status === "PAID";
    const r = await prisma.eventRegistration.updateMany({
      where: { id: reg.id, status: reg.status },
      data: { status: paid ? "REFUNDED" : "CANCELLED", cancelledAt: now, refundedAt: paid ? now : null, reservedUntil: null, offerExpiresAt: null },
    });
    if (r.count !== 1) continue;
    cancelled++;
    let didRefund = false;
    if (paid && reg.payment) {
      try {
        didRefund = (await refundPayment(reg.payment.id, `Event geannuleerd: ${reg.event.title}`)).refunded;
        if (didRefund) refunded++;
      } catch {
        didRefund = false;
      }
    }
    await notifyCancelled(reg.userId, reg.event, didRefund, true, args.reason);
  }
  return { cancelled, refunded };
}

// ---------------------------------------------------------------- check-in

export type CheckInResult =
  | { ok: true; already: boolean; registration: { id: string; ticketCode: string; displayName: string; divisionKey: string | null; eventTitle: string; eventId: string } }
  | { error: string; code: "not-found" | "bad-signature" | "wrong-event" | "status" | "window" };

export async function checkInByCode(args: {
  ticketCode: string;
  signature?: string | null;
  staffUserId: string;
  /** Beperk tot dit event (scanner-scherm staat op één event). */
  eventId?: string | null;
  /** Buiten het check-in-venster toch toestaan (staff-keuze). */
  force?: boolean;
}): Promise<CheckInResult> {
  const now = new Date();
  const reg = await prisma.eventRegistration.findUnique({
    where: { ticketCode: args.ticketCode },
    include: { event: { select: { id: true, title: true, startsAt: true, endsAt: true, status: true, countsForStampCard: true } }, user: { select: { displayName: true } } },
  });
  if (!reg) return { error: "Onbekende ticketcode", code: "not-found" };
  if (args.signature && !verifyTicketSignature(reg.ticketCode, reg.qrSecret, args.signature)) {
    return { error: "QR-code is niet geldig (handtekening klopt niet)", code: "bad-signature" };
  }
  if (args.eventId && reg.eventId !== args.eventId) {
    return { error: `Dit ticket hoort bij een ander event: ${reg.event.title}`, code: "wrong-event" };
  }
  const summary = {
    id: reg.id,
    ticketCode: reg.ticketCode,
    displayName: reg.user.displayName,
    divisionKey: reg.divisionKey,
    eventTitle: reg.event.title,
    eventId: reg.eventId,
  };
  if (reg.status === "CHECKED_IN") return { ok: true, already: true, registration: summary };
  if (!ACTIVE_TICKET_STATUSES.includes(reg.status as RegistrationStatus)) {
    return { error: `Ticket is niet geldig (status: ${reg.status})`, code: "status" };
  }
  if (reg.event.status !== "PUBLISHED") return { error: "Dit event is geannuleerd of afgerond", code: "status" };
  if (!args.force && !isWithinCheckInWindow(reg.event, now)) {
    return { error: "Buiten het check-in-venster (3 uur voor tot 3 uur na het event)", code: "window" };
  }
  const r = await prisma.eventRegistration.updateMany({
    where: { id: reg.id, status: "CONFIRMED" },
    data: { status: "CHECKED_IN", checkedInAt: now, checkedInById: args.staffUserId },
  });
  if (r.count !== 1) return { ok: true, already: true, registration: summary };
  // Fase 5: stempel + spaarpunten bij de eerste check-in (faalt nooit hard).
  await onCheckIn({ userId: reg.userId, eventId: reg.eventId, eventTitle: reg.event.title, countsForStampCard: reg.event.countsForStampCard, staffId: args.staffUserId });
  return { ok: true, already: false, registration: summary };
}

export async function undoCheckIn(registrationId: string): Promise<boolean> {
  const r = await prisma.eventRegistration.updateMany({
    where: { id: registrationId, status: "CHECKED_IN" },
    data: { status: "CONFIRMED", checkedInAt: null, checkedInById: null },
  });
  return r.count === 1;
}

/** Event afronden: CONFIRMED zonder check-in → NO_SHOW; event → COMPLETED. */
export async function completeEvent(eventId: string): Promise<{ noShows: number }> {
  const flipped = await prisma.shopEvent.updateMany({ where: { id: eventId, status: "PUBLISHED" }, data: { status: "COMPLETED" } });
  if (flipped.count !== 1) return { noShows: 0 };
  const r = await prisma.eventRegistration.updateMany({
    where: { eventId, status: "CONFIRMED" },
    data: { status: "NO_SHOW" },
  });
  // Open reserveringen/wachtlijst/aanbiedingen opruimen.
  await prisma.eventRegistration.updateMany({
    where: { eventId, status: { in: ["RESERVED", "WAITLIST", "OFFERED"] } },
    data: { status: "EXPIRED", reservedUntil: null, offerExpiresAt: null },
  });
  return { noShows: r.count };
}
