"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
