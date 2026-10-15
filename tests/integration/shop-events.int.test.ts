import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Meldingen (en dus mails) mocken: de echte createNotification trekt de hele
// auth-/mail-keten mee. We controleren alleen welke types verstuurd worden.
const notifications: Array<{ userId: string; type: string; title: string }> = [];
vi.mock("@/actions/notification", () => ({
  createNotification: vi.fn(async (userId: string, type: string, title: string) => {
    notifications.push({ userId, type, title });
  }),
}));

import { prisma } from "@/lib/prisma";
import {
  applyPaymentStatus,
  cancelRegistration,
  checkInByCode,
  expireReservations,
  expireWaitlistOffers,
  getEventAvailability,
  registerForEvent,
  startPaymentForRegistration,
} from "@/lib/shop-events/registrations";
import { signTicket } from "@/lib/shop-events/tickets";
import { POKEMON_DIVISIONS_2027 } from "@/lib/age";

const TAG = `int-${Date.now().toString(36)}`;
const DAY = 24 * 3600_000;

async function makeUser(name: string, dob: Date, extra: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      email: `${TAG}-${name}@test.local`,
      displayName: `${TAG}-${name}`.slice(0, 16),
      passwordHash: "x",
      emailVerifiedAt: new Date(),
      dateOfBirth: dob,
      bankTransferReference: `${TAG}${name}`.slice(0, 20),
      ...extra,
    },
  });
}

describe("winkel-events: inschrijven, betalen, wachtlijst, annuleren, check-in", () => {
  let typeId = "";
  let adminId = "";
  let adultA = "";
  let adultC = "";
  let kidB = "";
  let paidEventId = "";
  let freeEventId = "";

  beforeAll(async () => {
    const admin = await makeUser("admin", new Date(Date.UTC(1985, 0, 1)), { accountType: "ADMIN" });
    adminId = admin.id;
    adultA = (await makeUser("a", new Date(Date.UTC(1990, 5, 15)))).id;
    adultC = (await makeUser("c", new Date(Date.UTC(1995, 2, 3)))).id;
    // Geboren 2016 → in 2026 nog geen 12 → begeleiding nodig; <16 → ouder-toestemming nodig.
    kidB = (await makeUser("b", new Date(Date.UTC(2016, 0, 10)), { guardianConsentAt: new Date(), guardianEmail: "ouder@test.local" })).id;

    const type = await prisma.eventType.create({
      data: { key: `${TAG}-type`, name: `${TAG} toernooi`, ageDivisions: JSON.stringify(POKEMON_DIVISIONS_2027), color: "amber" },
    });
    typeId = type.id;
    const start = new Date(Date.now() + 2 * DAY);
    const paid = await prisma.shopEvent.create({
      data: { typeId, title: `${TAG} betaald`, startsAt: start, endsAt: new Date(start.getTime() + 3 * 3600_000), price: 5, capacity: 1, status: "PUBLISHED", publishedAt: new Date(), createdById: adminId },
    });
    paidEventId = paid.id;
    const free = await prisma.shopEvent.create({
      data: { typeId, title: `${TAG} gratis`, startsAt: start, endsAt: new Date(start.getTime() + 3 * 3600_000), price: 0, capacity: 5, status: "PUBLISHED", publishedAt: new Date(), createdById: adminId },
    });
    freeEventId = free.id;
  });

  afterAll(async () => {
    await prisma.eventRegistration.deleteMany({ where: { event: { typeId } } });
    await prisma.payment.deleteMany({ where: { user: { email: { startsWith: TAG } } } });
    await prisma.shopEvent.deleteMany({ where: { typeId } });
    await prisma.eventType.deleteMany({ where: { id: typeId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await prisma.$disconnect();
  });

  it("betaald event: reserveren → simulatie-checkout → betaald → ticket", async () => {
    const r = await registerForEvent({ eventId: paidEventId, userId: adultA, supervisedByAdult: false, joinWaitlist: false, locale: "nl" });
    expect("kind" in r && r.kind).toBe("payment");
    if (!("kind" in r) || r.kind !== "payment") return;
    expect(r.checkoutUrl).toContain("/nl/betalen/simuleer/");

    const reg = await prisma.eventRegistration.findUniqueOrThrow({ where: { id: r.registrationId }, include: { payment: true } });
    expect(reg.status).toBe("RESERVED");
    expect(reg.divisionKey).toBe("masters");
    expect(reg.payment?.provider).toBe("FAKE");
    expect(reg.ticketCode).toMatch(/^CC-[A-HJ-NP-Z2-9]{6}$/);

    const avail = await getEventAvailability({ id: paidEventId, capacity: 1 });
    expect(avail.full).toBe(true);

    const paid = await applyPaymentStatus({ paymentId: reg.paymentId!, providerStatus: "paid", source: "simulate" });
    expect("ok" in paid && paid.registrationStatus).toBe("CONFIRMED");
    // Idempotent: nog een keer "paid" verandert niets, een latere "failed" ook niet.
    await applyPaymentStatus({ paymentId: reg.paymentId!, providerStatus: "paid", source: "webhook" });
    const again = await applyPaymentStatus({ paymentId: reg.paymentId!, providerStatus: "failed", source: "webhook" });
    expect("ok" in again && again.paymentStatus).toBe("PAID");
    expect(notifications.filter((n) => n.userId === adultA && n.type === "EVENT_TICKET")).toHaveLength(1);
  });

  it("vol → wachtlijst; dubbel inschrijven geweigerd; <12 zonder begeleiding geweigerd", async () => {
    const full = await registerForEvent({ eventId: paidEventId, userId: adultC, supervisedByAdult: false, joinWaitlist: false, locale: "nl" });
    expect(full).toEqual({ kind: "full", waitlistAvailable: true });
    const wl = await registerForEvent({ eventId: paidEventId, userId: adultC, supervisedByAdult: false, joinWaitlist: true, locale: "nl" });
    expect("kind" in wl && wl.kind).toBe("waitlist");
    if ("kind" in wl && wl.kind === "waitlist") expect(wl.position).toBe(1);

    const dup = await registerForEvent({ eventId: paidEventId, userId: adultA, supervisedByAdult: false, joinWaitlist: false, locale: "nl" });
    expect("error" in dup && dup.reason).toBe("duplicate");

    const kid = await registerForEvent({ eventId: freeEventId, userId: kidB, supervisedByAdult: false, joinWaitlist: false, locale: "nl" });
    expect("error" in kid && kid.reason).toBe("supervision");
    const kidOk = await registerForEvent({ eventId: freeEventId, userId: kidB, supervisedByAdult: true, joinWaitlist: false, locale: "nl" });
    expect("kind" in kidOk && kidOk.kind).toBe("confirmed");
    const kidReg = await prisma.eventRegistration.findUniqueOrThrow({ where: { eventId_userId: { eventId: freeEventId, userId: kidB } } });
    expect(kidReg.divisionKey).toBe("junior");
    expect(kidReg.supervisedByAdult).toBe(true);
  });

  it("annuleren met terugbetaling → wachtlijst krijgt aanbod → betalen → ticket", async () => {
    const regA = await prisma.eventRegistration.findUniqueOrThrow({ where: { eventId_userId: { eventId: paidEventId, userId: adultA } } });
    const c = await cancelRegistration({ registrationId: regA.id, actorUserId: adultA, byStaff: false });
    expect(c).toMatchObject({ ok: true, refunded: true, status: "REFUNDED" });
    const payA = await prisma.payment.findUniqueOrThrow({ where: { id: regA.paymentId! } });
    expect(payA.status).toBe("REFUNDED");
    expect(payA.refundedAmount).toBe(5);

    const regC = await prisma.eventRegistration.findUniqueOrThrow({ where: { eventId_userId: { eventId: paidEventId, userId: adultC } } });
    expect(regC.status).toBe("OFFERED");
    expect(regC.offerExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
    expect(notifications.some((n) => n.userId === adultC && n.type === "EVENT_WAITLIST_OFFER")).toBe(true);

    // A mag niet opnieuw zolang de plek aan C is aangeboden (vol).
    const again = await registerForEvent({ eventId: paidEventId, userId: adultA, supervisedByAdult: false, joinWaitlist: false, locale: "nl" });
    expect(again).toEqual({ kind: "full", waitlistAvailable: true });

    const pay = await startPaymentForRegistration({ registrationId: regC.id, userId: adultC, locale: "nl" });
    expect("kind" in pay && pay.kind).toBe("payment");
    const regC2 = await prisma.eventRegistration.findUniqueOrThrow({ where: { id: regC.id } });
    expect(regC2.paymentId).toBeTruthy();
    const done = await applyPaymentStatus({ paymentId: regC2.paymentId!, providerStatus: "paid", source: "simulate" });
    expect("ok" in done && done.registrationStatus).toBe("CONFIRMED");
  });

  it("check-in: handtekening, dubbele scan, buiten venster", async () => {
    const regC = await prisma.eventRegistration.findUniqueOrThrow({ where: { eventId_userId: { eventId: paidEventId, userId: adultC } } });
    const bad = await checkInByCode({ ticketCode: regC.ticketCode, signature: "0000000000000000", staffUserId: adminId, force: true });
    expect("error" in bad && bad.code).toBe("bad-signature");

    const outside = await checkInByCode({ ticketCode: regC.ticketCode, staffUserId: adminId });
    expect("error" in outside && outside.code).toBe("window");

    const ok = await checkInByCode({ ticketCode: regC.ticketCode, signature: signTicket(regC.ticketCode, regC.qrSecret), staffUserId: adminId, force: true });
    expect("ok" in ok && ok.already).toBe(false);
    const twice = await checkInByCode({ ticketCode: regC.ticketCode, staffUserId: adminId, force: true });
    expect("ok" in twice && twice.already).toBe(true);
    const unknown = await checkInByCode({ ticketCode: "CC-ZZZZZZ", staffUserId: adminId, force: true });
    expect("error" in unknown && unknown.code).toBe("not-found");
  });

  it("cron: verlopen reservering vrijgeven, verlopen aanbod vervalt", async () => {
    // Nieuwe vrije plek nodig: capaciteit omhoog, A reserveert en de reservering is 'oud'.
    await prisma.shopEvent.update({ where: { id: paidEventId }, data: { capacity: 2 } });
    const r = await registerForEvent({ eventId: paidEventId, userId: adultA, supervisedByAdult: false, joinWaitlist: false, locale: "nl" });
    expect("kind" in r && r.kind).toBe("payment");
    if (!("kind" in r) || r.kind !== "payment") return;
    await prisma.eventRegistration.update({ where: { id: r.registrationId }, data: { reservedUntil: new Date(Date.now() - 60_000) } });
    const exp = await expireReservations();
    expect(exp.expired).toBeGreaterThanOrEqual(1);
    expect((await prisma.eventRegistration.findUniqueOrThrow({ where: { id: r.registrationId } })).status).toBe("EXPIRED");

    // Late betaling op een verlopen reservering pakt alsnog de vrije plek.
    const reg = await prisma.eventRegistration.findUniqueOrThrow({ where: { id: r.registrationId }, include: { payment: true } });
    const payment = await prisma.payment.findFirstOrThrow({ where: { userId: adultA, status: { in: ["OPEN", "PENDING"] } }, orderBy: { createdAt: "desc" } });
    await prisma.eventRegistration.update({ where: { id: reg.id }, data: { paymentId: payment.id } });
    const late = await applyPaymentStatus({ paymentId: payment.id, providerStatus: "paid", source: "webhook" });
    expect("ok" in late && late.registrationStatus).toBe("CONFIRMED");

    // Verlopen wachtlijst-aanbod → EXPIRED + melding.
    await prisma.shopEvent.update({ where: { id: paidEventId }, data: { capacity: 3 } });
    const wl = await prisma.eventRegistration.create({
      data: { eventId: paidEventId, userId: kidB, status: "OFFERED", offerExpiresAt: new Date(Date.now() - 1000), ticketCode: "CC-TESTX2", qrSecret: "s", amount: 5 },
    });
    const expOffers = await expireWaitlistOffers();
    expect(expOffers.expired).toBeGreaterThanOrEqual(1);
    expect((await prisma.eventRegistration.findUniqueOrThrow({ where: { id: wl.id } })).status).toBe("EXPIRED");
    expect(notifications.some((n) => n.userId === kidB && n.type === "EVENT_WAITLIST_EXPIRED")).toBe(true);
  });
});
