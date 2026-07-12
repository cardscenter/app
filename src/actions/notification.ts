"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publish, userChannel } from "@/lib/realtime";
import { maybeSendNotificationEmail } from "@/lib/email/notification-email";

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string
) {
  await prisma.notification.create({
    data: { userId, type, title, body, link },
  });

  // Real-time bell-update (Fase 30A) — geef de verse unreadCount mee zodat
  // de client geen extra GET hoeft te doen.
  const unreadCount = await prisma.notification.count({
    where: { userId, read: false },
  });
  publish(userChannel(userId), {
    type: "notification-created",
    payload: { unreadCount },
  });

  // E-mail-dispatch (Fase 16) — fire-and-forget: categorie-map + voorkeuren +
  // throttle zitten in de dispatcher; een mailfout mag de actie nooit breken.
  void maybeSendNotificationEmail({ userId, type, title, body, link }).catch((err) =>
    console.error("[email] dispatch faalde:", err),
  );
}

export async function getUnreadCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  return prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });
}

export async function markAsRead(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });

  return { success: true };
}

export async function markAllAsRead() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  return { success: true };
}

/**
 * Laatste N notificaties voor de bell-popover. Read+unread combined,
 * meest-recente eerst. Gebruikt door /api/notifications/recent.
 */
export async function getRecentNotifications(limit = 6) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      link: true,
      read: true,
      createdAt: true,
    },
  });
}
