"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { rsvpStatusSchema } from "@/lib/validations/event";

/** RSVP à la Facebook: "Geïnteresseerd" of "Ik ben aanwezig" (of NONE om de
 *  huidige status te verwijderen). Geen notificaties — dit zou de organisator
 *  spammen; de teller op de detailpagina is het signaal. */
export async function setEventRsvp(eventId: string, status: "INTERESTED" | "GOING" | "NONE") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const parsed = rsvpStatusSchema.safeParse(status);
  if (!parsed.success) return { error: "Ongeldige status" };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, endTime: true, organizerId: true },
  });
  if (!event || event.status !== "LIVE" || event.endTime <= new Date()) {
    return { error: "Dit evenement is niet (meer) beschikbaar" };
  }
  if (event.organizerId === userId) {
    return { error: "Je bent zelf de organisator van dit evenement" };
  }

  if (parsed.data === "NONE") {
    await prisma.eventRsvp.deleteMany({ where: { eventId, userId } });
  } else {
    await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status: parsed.data },
      update: { status: parsed.data },
    });
  }

  revalidatePath(`/evenementen/${eventId}`);
  return { success: true };
}
