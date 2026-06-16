"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportEventSchema } from "@/lib/validations/event";

/** "Meld dit event"-knop. Ingelogd, niet je eigen event, max één open melding
 *  per (reporter, event). Belandt in de admin reports-queue. */
export async function reportEvent(eventId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true, status: true },
  });
  if (!event) return { error: "Evenement niet gevonden" };
  if (event.organizerId === userId) {
    return { error: "Je kunt je eigen evenement niet melden" };
  }

  const parsed = reportEventSchema.safeParse({
    reason: formData.get("reason"),
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige melding" };
  }

  const existingOpen = await prisma.eventReport.findFirst({
    where: {
      reporterId: userId,
      eventId,
      status: { in: ["OPEN", "REVIEWING"] },
    },
    select: { id: true },
  });
  if (existingOpen) {
    return { error: "Je hebt al een openstaande melding voor dit evenement." };
  }

  await prisma.eventReport.create({
    data: {
      reporterId: userId,
      eventId,
      reason: parsed.data.reason,
      details: parsed.data.details,
      status: "OPEN",
    },
  });

  return { success: true };
}
