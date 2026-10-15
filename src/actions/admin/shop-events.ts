"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { createNotification } from "@/actions/notification";
import { writeHubSettings } from "@/lib/app-config";
import { newQrSecret } from "@/lib/shop-events/tickets";
import { generateTicketCode, parseAgeDivisions, divisionKeyFor } from "@/lib/shop-events/config";
import { cancelRegistration, cancelWholeEvent, completeEvent, ensureEventTypes, getEventAvailability } from "@/lib/shop-events/registrations";
import { eventTypeSchema, shopEventSchema, hubSettingsSchema, formDataToObject, firstZodError } from "@/lib/validations/shop-event";
import { formatEventDate, formatEventTime } from "@/lib/shop-events/format";

/**
 * Admin-acties voor winkel-events (Fase 3). Patroon: requireAdmin →
 * schrijven → logAdminAction (zie CLAUDE.md, "Admin panel").
 */

const EVENT_BOOLEANS = ["underTwelveWithAdult", "waitlistEnabled", "countsForLeague", "countsForStampCard", "showParticipants"] as const;
const TYPE_BOOLEANS = ["countsForLeague", "countsForStampCard", "enabled"] as const;

function revalidateAll(eventId?: string) {
  revalidatePath("/evenementen");
  revalidatePath("/dashboard/admin/events");
  if (eventId) {
    revalidatePath(`/evenementen/${eventId}`);
    revalidatePath(`/dashboard/admin/events/${eventId}`);
  }
}

// ---------------------------------------------------------------- event-types

export async function saveEventType(formData: FormData, existingId?: string | null) {
  const { adminId } = await requireAdmin();
  await ensureEventTypes();
  const parsed = eventTypeSchema.safeParse(formDataToObject(formData, TYPE_BOOLEANS));
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const data = parsed.data;

  const clash = await prisma.eventType.findUnique({ where: { key: data.key }, select: { id: true } });
  if (clash && clash.id !== existingId) return { error: "Deze sleutel bestaat al" };

  const row = existingId
    ? await prisma.eventType.update({ where: { id: existingId }, data })
    : await prisma.eventType.create({ data });
  await logAdminAction({
    adminId,
    action: existingId ? "UPDATE_EVENT_TYPE" : "CREATE_EVENT_TYPE",
    targetType: "EVENT_TYPE",
    targetId: row.id,
    metadata: { key: row.key, name: row.name },
  });
  revalidatePath("/dashboard/admin/event-types");
  revalidateAll();
  return { success: true, id: row.id };
}

export async function toggleEventType(id: string, enabled: boolean) {
  const { adminId } = await requireAdmin();
  const row = await prisma.eventType.update({ where: { id }, data: { enabled } });
  await logAdminAction({ adminId, action: "UPDATE_EVENT_TYPE", targetType: "EVENT_TYPE", targetId: id, metadata: { enabled, key: row.key } });
  revalidatePath("/dashboard/admin/event-types");
  return { success: true };
}

// ---------------------------------------------------------------- events

export async function createShopEvent(formData: FormData) {
  const { adminId } = await requireAdmin();
  const parsed = shopEventSchema.safeParse(formDataToObject(formData, EVENT_BOOLEANS));
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const type = await prisma.eventType.findUnique({ where: { id: parsed.data.typeId }, select: { id: true, game: true } });
  if (!type) return { error: "Onbekend event-type" };

  const event = await prisma.shopEvent.create({
    data: { ...parsed.data, game: parsed.data.game ?? type.game, createdById: adminId },
  });
  await logAdminAction({ adminId, action: "CREATE_SHOP_EVENT", targetType: "SHOP_EVENT", targetId: event.id, metadata: { title: event.title } });
  revalidateAll(event.id);
  return { success: true, id: event.id };
}

export async function updateShopEvent(eventId: string, formData: FormData) {
  const { adminId } = await requireAdmin();
  const parsed = shopEventSchema.safeParse(formDataToObject(formData, EVENT_BOOLEANS));
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const existing = await prisma.shopEvent.findUnique({ where: { id: eventId }, select: { status: true, price: true } });
  if (!existing) return { error: "Event niet gevonden" };
  if (existing.status === "CANCELLED" || existing.status === "COMPLETED") return { error: "Een geannuleerd of afgerond event kun je niet meer bewerken" };

  // Prijs wijzigen na publicatie zou bestaande (betaalde) inschrijvingen scheef trekken.
  if (existing.status === "PUBLISHED" && existing.price !== parsed.data.price) {
    const paidCount = await prisma.eventRegistration.count({ where: { eventId, status: { in: ["CONFIRMED", "CHECKED_IN", "RESERVED", "OFFERED"] } } });
    if (paidCount > 0) return { error: "De prijs kun je niet meer wijzigen zolang er inschrijvingen zijn. Annuleer het event of maak een nieuw event." };
  }

  const event = await prisma.shopEvent.update({ where: { id: eventId }, data: parsed.data });
  await logAdminAction({ adminId, action: "UPDATE_SHOP_EVENT", targetType: "SHOP_EVENT", targetId: eventId, metadata: { title: event.title } });
  revalidateAll(eventId);
  return { success: true };
}

export async function publishShopEvent(eventId: string, publish: boolean) {
  const { adminId } = await requireAdmin();
  const existing = await prisma.shopEvent.findUnique({ where: { id: eventId }, select: { status: true, startsAt: true } });
  if (!existing) return { error: "Event niet gevonden" };
  if (publish) {
    if (existing.status !== "DRAFT") return { error: "Alleen een concept kun je publiceren" };
    if (existing.startsAt <= new Date()) return { error: "De startdatum ligt in het verleden" };
    await prisma.shopEvent.update({ where: { id: eventId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  } else {
    if (existing.status !== "PUBLISHED") return { error: "Dit event is niet gepubliceerd" };
    const active = await prisma.eventRegistration.count({ where: { eventId, status: { in: ["CONFIRMED", "CHECKED_IN", "RESERVED", "OFFERED", "WAITLIST"] } } });
    if (active > 0) return { error: "Er zijn al inschrijvingen. Annuleer het event als het niet doorgaat." };
    await prisma.shopEvent.update({ where: { id: eventId }, data: { status: "DRAFT", publishedAt: null } });
  }
  await logAdminAction({ adminId, action: "PUBLISH_SHOP_EVENT", targetType: "SHOP_EVENT", targetId: eventId, metadata: { publish } });
  revalidateAll(eventId);
  return { success: true };
}

export async function cancelShopEvent(eventId: string, reason: string) {
  const { adminId } = await requireAdmin();
  const r = reason.trim();
  if (r.length < 3) return { error: "Geef een reden op (die krijgen de deelnemers te zien)" };
  const result = await cancelWholeEvent({ eventId, adminId, reason: r.slice(0, 500) });
  await logAdminAction({ adminId, action: "CANCEL_SHOP_EVENT", targetType: "SHOP_EVENT", targetId: eventId, metadata: { reason: r, ...result } });
  revalidateAll(eventId);
  revalidatePath("/dashboard/tickets");
  return { success: true, ...result };
}

export async function completeShopEvent(eventId: string) {
  const { adminId } = await requireAdmin();
  const existing = await prisma.shopEvent.findUnique({ where: { id: eventId }, select: { status: true, endsAt: true } });
  if (!existing) return { error: "Event niet gevonden" };
  if (existing.status !== "PUBLISHED") return { error: "Alleen een gepubliceerd event kun je afronden" };
  if (existing.endsAt > new Date()) return { error: "Het event is nog niet afgelopen" };
  const result = await completeEvent(eventId);
  await logAdminAction({ adminId, action: "COMPLETE_SHOP_EVENT", targetType: "SHOP_EVENT", targetId: eventId, metadata: result });
  revalidateAll(eventId);
  return { success: true, ...result };
}

/** Kopie als concept (zelfde instellingen, een week later). */
export async function duplicateShopEvent(eventId: string) {
  const { adminId } = await requireAdmin();
  const src = await prisma.shopEvent.findUnique({ where: { id: eventId } });
  if (!src) return { error: "Event niet gevonden" };
  const week = 7 * 24 * 3600_000;
  const copy = await prisma.shopEvent.create({
    data: {
      typeId: src.typeId,
      title: src.title,
      description: src.description,
      game: src.game,
      startsAt: new Date(src.startsAt.getTime() + week),
      endsAt: new Date(src.endsAt.getTime() + week),
      registrationOpensAt: src.registrationOpensAt ? new Date(src.registrationOpensAt.getTime() + week) : null,
      registrationDeadline: src.registrationDeadline ? new Date(src.registrationDeadline.getTime() + week) : null,
      price: src.price,
      capacity: src.capacity,
      minAge: src.minAge,
      maxAge: src.maxAge,
      underTwelveWithAdult: src.underTwelveWithAdult,
      waitlistEnabled: src.waitlistEnabled,
      countsForLeague: src.countsForLeague,
      countsForStampCard: src.countsForStampCard,
      showParticipants: src.showParticipants,
      cancellationHours: src.cancellationHours,
      refundPolicy: src.refundPolicy,
      coverImage: src.coverImage,
      status: "DRAFT",
      createdById: adminId,
    },
  });
  await logAdminAction({ adminId, action: "DUPLICATE_SHOP_EVENT", targetType: "SHOP_EVENT", targetId: copy.id, metadata: { from: eventId } });
  revalidateAll();
  return { success: true, id: copy.id };
}

// ---------------------------------------------------------------- inschrijvingen

export async function adminCancelRegistration(registrationId: string, reason: string) {
  const { adminId } = await requireAdmin();
  const result = await cancelRegistration({ registrationId, actorUserId: adminId, byStaff: true, reason: reason.trim() || null });
  if ("error" in result) return result;
  const reg = await prisma.eventRegistration.findUnique({ where: { id: registrationId }, select: { eventId: true } });
  await logAdminAction({ adminId, action: "ADMIN_CANCEL_REGISTRATION", targetType: "EVENT_REGISTRATION", targetId: registrationId, metadata: { reason, refunded: result.refunded } });
  revalidateAll(reg?.eventId);
  revalidatePath("/dashboard/tickets");
  return { success: true, refunded: result.refunded };
}

/**
 * Handmatig toevoegen (aan de balie betaald, of gratis plek). Maakt direct
 * een CONFIRMED-ticket zonder Mollie; `amount` is wat aan de balie betaald is.
 */
export async function adminAddRegistration(eventId: string, emailOrName: string, amount: number, note: string) {
  const { adminId } = await requireAdmin();
  const q = emailOrName.trim();
  if (!q) return { error: "Vul een e-mailadres of gebruikersnaam in" };
  const event = await prisma.shopEvent.findUnique({ where: { id: eventId }, include: { type: { select: { ageDivisions: true } } } });
  if (!event) return { error: "Event niet gevonden" };
  if (event.status !== "PUBLISHED") return { error: "Alleen voor een gepubliceerd event" };

  const user = await prisma.user.findFirst({
    where: { deletedAt: null, OR: [{ email: q.toLowerCase() }, { displayName: q }] },
    select: { id: true, displayName: true, dateOfBirth: true },
  });
  if (!user) return { error: "Geen speler gevonden met dat e-mailadres of die gebruikersnaam" };

  const existing = await prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId, userId: user.id } } });
  if (existing && ["RESERVED", "CONFIRMED", "OFFERED", "CHECKED_IN"].includes(existing.status)) return { error: `${user.displayName} staat al ingeschreven` };

  const availability = await getEventAvailability(event);
  if (availability.full) return { error: "Het event is vol" };

  const now = new Date();
  const data = {
    status: "CONFIRMED",
    confirmedAt: now,
    amount: Math.max(0, amount),
    divisionKey: divisionKeyFor(user.dateOfBirth, parseAgeDivisions(event.type.ageDivisions)),
    note: note.trim() ? `Handmatig toegevoegd: ${note.trim()}` : "Handmatig toegevoegd",
    reservedUntil: null,
    offerExpiresAt: null,
    waitlistJoinedAt: null,
    cancelledAt: null,
    refundedAt: null,
    checkedInAt: null,
    checkedInById: null,
    paymentId: null,
  };
  const row = existing
    ? await prisma.eventRegistration.update({ where: { id: existing.id }, data })
    : await prisma.eventRegistration.create({
        data: { ...data, eventId, userId: user.id, ticketCode: generateTicketCode(), qrSecret: newQrSecret() },
      });

  await logAdminAction({ adminId, action: "ADMIN_ADD_REGISTRATION", targetType: "EVENT_REGISTRATION", targetId: row.id, metadata: { userId: user.id, amount } });
  await createNotification(
    user.id,
    "EVENT_TICKET",
    `Je ticket voor ${event.title}`,
    `Je bent door de winkel ingeschreven voor ${event.title} op ${formatEventDate(event.startsAt)} om ${formatEventTime(event.startsAt)}. Je ticketcode is ${row.ticketCode}.`,
    `/dashboard/tickets/${row.ticketCode}`,
  );
  revalidateAll(eventId);
  return { success: true, ticketCode: row.ticketCode };
}

// ---------------------------------------------------------------- instellingen

export async function updateHubSettings(formData: FormData) {
  const { adminId } = await requireAdmin();
  const parsed = hubSettingsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  await writeHubSettings(parsed.data);
  await logAdminAction({ adminId, action: "UPDATE_HUB_SETTINGS", targetType: "HUB_SETTINGS", metadata: { maxOccupancy: parsed.data.maxOccupancy } });
  revalidatePath("/dashboard/admin/hub-settings");
  revalidateAll();
  return { success: true };
}
