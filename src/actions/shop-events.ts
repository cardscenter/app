"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNotSuspended } from "@/lib/suspension";
import { isMollieConfigured, isPaymentSimulationAllowed } from "@/lib/mollie";
import {
  applyPaymentStatus,
  cancelRegistration,
  registerForEvent,
  startPaymentForRegistration,
  syncPaymentFromProvider,
  type RegisterOutcome,
} from "@/lib/shop-events/registrations";

/**
 * Server actions voor spelers (winkel-events, Fase 3). Dunne wrappers rond
 * de statusmachine in `src/lib/shop-events/registrations.ts`.
 */

function revalidateEvent(eventId: string) {
  revalidatePath(`/evenementen/${eventId}`);
  revalidatePath("/evenementen");
  revalidatePath("/dashboard/tickets");
}

export async function registerForShopEvent(
  eventId: string,
  opts: { supervisedByAdult?: boolean; joinWaitlist?: boolean; locale?: string } = {},
): Promise<RegisterOutcome> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Log eerst in om je in te schrijven." };
  const sus = await requireNotSuspended(session.user.id);
  if ("error" in sus) return { error: sus.error };

  const result = await registerForEvent({
    eventId,
    userId: session.user.id,
    supervisedByAdult: !!opts.supervisedByAdult,
    joinWaitlist: !!opts.joinWaitlist,
    locale: opts.locale ?? "nl",
  });
  if (!("error" in result)) revalidateEvent(eventId);
  return result;
}

/** Nieuwe betaalpoging (RESERVED na mislukte betaling, of OFFERED vanaf de wachtlijst). */
export async function payForRegistration(registrationId: string, locale = "nl") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Log eerst in." };
  const result = await startPaymentForRegistration({ registrationId, userId: session.user.id, locale });
  if (!("error" in result)) {
    const reg = await prisma.eventRegistration.findUnique({ where: { id: registrationId }, select: { eventId: true } });
    if (reg) revalidateEvent(reg.eventId);
  }
  return result;
}

export async function cancelMyRegistration(registrationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Log eerst in." };
  const result = await cancelRegistration({ registrationId, actorUserId: session.user.id, byStaff: false });
  if ("ok" in result) {
    const reg = await prisma.eventRegistration.findUnique({ where: { id: registrationId }, select: { eventId: true } });
    if (reg) revalidateEvent(reg.eventId);
  }
  return result;
}

/**
 * Terugkeer van de checkout: status bij Mollie ophalen (als geconfigureerd)
 * en de actuele inschrijvingsstatus teruggeven. De webhook blijft leidend.
 */
export async function refreshRegistrationStatus(registrationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Log eerst in." };
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: { id: true, userId: true, status: true, ticketCode: true, eventId: true, paymentId: true, payment: { select: { status: true, checkoutUrl: true } } },
  });
  if (!reg || reg.userId !== session.user.id) return { error: "Inschrijving niet gevonden" };
  if (reg.paymentId && reg.payment && (reg.payment.status === "OPEN" || reg.payment.status === "PENDING") && isMollieConfigured()) {
    await syncPaymentFromProvider(reg.paymentId, "return");
  }
  const fresh = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: { status: true, ticketCode: true, eventId: true, payment: { select: { status: true, checkoutUrl: true } } },
  });
  return {
    status: fresh?.status ?? reg.status,
    ticketCode: fresh?.ticketCode ?? reg.ticketCode,
    eventId: reg.eventId,
    paymentStatus: fresh?.payment?.status ?? null,
    checkoutUrl: fresh?.payment?.checkoutUrl ?? null,
  };
}

/**
 * Simulatiemodus (geen MOLLIE_API_KEY): de "bank" kiest geslaagd/mislukt.
 * Alleen de eigenaar van de betaling mag dit, en alleen zonder Mollie-key.
 */
export async function simulatePayment(paymentId: string, outcome: "paid" | "failed" | "canceled", guestToken?: string | null) {
  if (!isPaymentSimulationAllowed()) return { error: "Simulatie is uitgeschakeld." };
  const session = await auth();
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { userId: true, provider: true, purpose: true, metadata: true, registration: { select: { eventId: true } } },
  });
  if (!payment) return { error: "Betaling niet gevonden" };
  // Eigenaar: ingelogde gebruiker, of (eten bestellen, gast) het accessToken uit de metadata.
  let allowed = !!session?.user?.id && payment.userId === session.user.id;
  if (!allowed && payment.purpose === "FOOD_ORDER" && guestToken) {
    try {
      const meta = JSON.parse(payment.metadata ?? "{}") as { accessToken?: string };
      allowed = !!meta.accessToken && meta.accessToken === guestToken;
    } catch {
      allowed = false;
    }
  }
  if (!allowed) return { error: "Betaling niet gevonden" };
  if (payment.provider !== "FAKE") return { error: "Dit is geen simulatiebetaling" };
  const result = await applyPaymentStatus({ paymentId, providerStatus: outcome, source: "simulate" });
  if (payment.registration) revalidateEvent(payment.registration.eventId);
  return result;
}
