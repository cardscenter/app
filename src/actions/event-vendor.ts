"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEmailVerified } from "@/lib/email-verification";
import { createNotification } from "@/actions/notification";
import { vendorRequestSchema } from "@/lib/validations/event";

/** Standhouder vraagt de organisator om vermelding bij "Aanwezige standhouders
 *  op dit event". E-mail-verificatie is verplicht. Herkansing na REJECTED is
 *  toegestaan (upsert terug naar PENDING). */
export async function requestVendorSpot(eventId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const verified = await requireEmailVerified(userId);
  if ("error" in verified) {
    return { error: "Bevestig eerst je e-mailadres voordat je een standhouder-aanvraag kunt doen." };
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, endTime: true, organizerId: true, title: true },
  });
  if (!event || event.status !== "LIVE" || event.endTime <= new Date()) {
    return { error: "Dit evenement is niet (meer) beschikbaar" };
  }
  if (event.organizerId === userId) {
    return { error: "Je bent zelf de organisator van dit evenement" };
  }

  const parsed = vendorRequestSchema.safeParse({ message: formData.get("message") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige aanvraag" };

  const existing = await prisma.eventVendorRequest.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { status: true },
  });
  if (existing?.status === "PENDING") return { error: "Je hebt al een aanvraag lopen voor dit evenement" };
  if (existing?.status === "APPROVED") return { error: "Je staat al in de standhouderslijst" };

  await prisma.eventVendorRequest.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, message: parsed.data.message ?? null, status: "PENDING" },
    update: { status: "PENDING", message: parsed.data.message ?? null, decidedAt: null },
  });

  await createNotification(
    event.organizerId,
    "EVENT_VENDOR_REQUEST",
    "Nieuwe standhouder-aanvraag",
    `Iemand wil als standhouder vermeld worden bij "${event.title}". Beoordeel de aanvraag in je dashboard.`,
    "/dashboard/evenementen",
  );

  revalidatePath(`/evenementen/${eventId}`);
  revalidatePath("/dashboard/evenementen");
  return { success: true };
}

/** Organisator keurt een aanvraag goed of af. */
export async function respondToVendorRequest(requestId: string, decision: "APPROVED" | "REJECTED") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  if (decision !== "APPROVED" && decision !== "REJECTED") return { error: "Ongeldige beslissing" };

  const request = await prisma.eventVendorRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true, status: true, userId: true,
      event: { select: { id: true, organizerId: true, title: true } },
    },
  });
  if (!request) return { error: "Aanvraag niet gevonden" };
  if (request.event.organizerId !== session.user.id) return { error: "Niet bevoegd" };
  if (request.status !== "PENDING") return { error: "Deze aanvraag is al behandeld" };

  await prisma.eventVendorRequest.update({
    where: { id: requestId },
    data: { status: decision, decidedAt: new Date() },
  });

  if (decision === "APPROVED") {
    await createNotification(
      request.userId,
      "EVENT_VENDOR_APPROVED",
      "Standhouder-aanvraag goedgekeurd",
      `Je staat nu in de standhouderslijst van "${request.event.title}".`,
      `/evenementen/${request.event.id}`,
    );
  } else {
    await createNotification(
      request.userId,
      "EVENT_VENDOR_REJECTED",
      "Standhouder-aanvraag afgewezen",
      `De organisator van "${request.event.title}" heeft je aanvraag afgewezen.`,
      `/evenementen/${request.event.id}`,
    );
  }

  revalidatePath(`/evenementen/${request.event.id}`);
  revalidatePath("/dashboard/evenementen");
  return { success: true };
}

/** Aanvrager trekt een nog openstaande aanvraag in. */
export async function withdrawVendorRequest(requestId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const request = await prisma.eventVendorRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, userId: true, eventId: true },
  });
  if (!request) return { error: "Aanvraag niet gevonden" };
  if (request.userId !== session.user.id) return { error: "Niet bevoegd" };
  if (request.status !== "PENDING") return { error: "Deze aanvraag is al behandeld" };

  await prisma.eventVendorRequest.delete({ where: { id: requestId } });

  revalidatePath(`/evenementen/${request.eventId}`);
  revalidatePath("/dashboard/evenementen");
  return { success: true };
}
