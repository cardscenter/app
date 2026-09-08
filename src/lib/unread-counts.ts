import { prisma } from "@/lib/prisma";

// Ongelezen-tellers per gebruiker — plain lib (geen "use server") zodat de
// dashboard-layout ze met een userId kan aanroepen zonder dat er een publiek
// aanroepbare server-action met userId-argument ontstaat. De sessie-varianten
// voor client-componenten blijven in src/actions/message.ts + notification.ts.

/**
 * Hoeveel conversaties hebben ongelezen berichten voor deze user. Telt elke
 * conversatie max 1 keer (niet per bericht) — match wat het message-icon in
 * de header laat zien.
 */
export async function getUnreadConversationCountFor(userId: string): Promise<number> {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId, status: { not: "DELETED" } },
    select: { conversationId: true, lastReadAt: true },
  });
  if (participations.length === 0) return 0;

  let unreadCount = 0;
  for (const p of participations) {
    const hasUnread = await prisma.message.findFirst({
      where: {
        conversationId: p.conversationId,
        senderId: { not: userId },
        ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
      },
      select: { id: true },
    });
    if (hasUnread) unreadCount++;
  }
  return unreadCount;
}

/** Aantal ongelezen meldingen (zelfde query als `getUnreadCount` in notification.ts). */
export async function getUnreadNotificationCountFor(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}
