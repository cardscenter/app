"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/roles-server";
import { normalizeTicketCode } from "@/lib/shop-events/config";
import { parseQrPayload } from "@/lib/shop-events/tickets";
import { checkInByCode, undoCheckIn, type CheckInResult } from "@/lib/shop-events/registrations";

/**
 * Staff-acties (Community Hub, Fase 3): inchecken bij de deur. Alleen voor
 * accounts met rol STAFF of ADMIN (`requireStaff`, leest de rol vers uit de DB).
 */

/**
 * Scan of handmatige invoer. `raw` mag de QR-payload ("CC|CODE|SIG") zijn of
 * een ticketcode ("CC-ABC123" / "ABC123"). Met QR wordt de handtekening
 * gecontroleerd; bij handmatige invoer niet (staff ziet de naam ter controle).
 */
export async function checkInTicket(raw: string, opts: { eventId?: string | null; force?: boolean } = {}): Promise<CheckInResult> {
  let staff: { userId: string };
  try {
    staff = await requireStaff();
  } catch {
    return { error: "Geen toegang", code: "status" };
  }
  const qr = parseQrPayload(raw);
  const code = normalizeTicketCode(qr ? qr.code : raw);
  if (!code) return { error: "Geen geldige ticketcode", code: "not-found" };
  const result = await checkInByCode({
    ticketCode: code,
    signature: qr?.sig ?? null,
    staffUserId: staff.userId,
    eventId: opts.eventId ?? null,
    force: !!opts.force,
  });
  if ("ok" in result) {
    revalidatePath(`/dashboard/staff/check-in`);
    revalidatePath(`/dashboard/admin/events/${result.registration.eventId}`);
  }
  return result;
}

export async function undoTicketCheckIn(registrationId: string) {
  try {
    await requireStaff();
  } catch {
    return { error: "Geen toegang" };
  }
  const ok = await undoCheckIn(registrationId);
  if (!ok) return { error: "Niet ingecheckt of al teruggedraaid" };
  const reg = await prisma.eventRegistration.findUnique({ where: { id: registrationId }, select: { eventId: true } });
  revalidatePath(`/dashboard/staff/check-in`);
  if (reg) revalidatePath(`/dashboard/admin/events/${reg.eventId}`);
  return { success: true };
}

/** Handmatig inchecken vanuit de deelnemerslijst (zonder code). */
export async function checkInRegistrationById(registrationId: string, force = false): Promise<CheckInResult> {
  let staff: { userId: string };
  try {
    staff = await requireStaff();
  } catch {
    return { error: "Geen toegang", code: "status" };
  }
  const reg = await prisma.eventRegistration.findUnique({ where: { id: registrationId }, select: { ticketCode: true } });
  if (!reg) return { error: "Inschrijving niet gevonden", code: "not-found" };
  const result = await checkInByCode({ ticketCode: reg.ticketCode, staffUserId: staff.userId, force });
  if ("ok" in result) {
    revalidatePath(`/dashboard/staff/check-in`);
    revalidatePath(`/dashboard/admin/events/${result.registration.eventId}`);
  }
  return result;
}
