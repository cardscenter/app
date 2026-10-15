"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNotSuspended } from "@/lib/suspension";
import { getBlockedUserIds } from "@/lib/blocking";
import { createNotification } from "@/actions/notification";
import { getFullName } from "@/lib/user-name";
import { revalidatePath } from "next/cache";

/**
 * Volgen (profiel-redesign sept 2026; dekt open Fase 19 "favoriete
 * verkopers"). Idempotent: dubbel volgen is geen fout. Geblokkeerde
 * gebruikers (beide richtingen) kunnen elkaar niet volgen.
 */
export async function followUser(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;
  if (userId === targetUserId) return { error: "Je kunt jezelf niet volgen" };

  const suspended = await requireNotSuspended(userId);
  if (suspended && "error" in suspended) return suspended;

  const blocked = await getBlockedUserIds(userId);
  if (blocked.has(targetUserId)) return { error: "Je kunt deze gebruiker niet volgen" };

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!target) return { error: "Gebruiker niet gevonden" };

  const existing = await prisma.userFollow.findUnique({
    where: { followerId_followingId: { followerId: userId, followingId: targetUserId } },
    select: { id: true },
  });
  if (existing) return { success: true, alreadyFollowing: true };

  await prisma.userFollow.create({ data: { followerId: userId, followingId: targetUserId } });

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, firstName: true, lastName: true },
  });
  if (me) {
    await createNotification(
      targetUserId,
      "NEW_FOLLOWER",
      "Nieuwe volger",
      `${getFullName(me)} (@${me.displayName}) volgt je nu.`,
      `/spelers/${userId}`,
    );
  }

  revalidatePath(`/spelers/${targetUserId}`);
  return { success: true };
}

export async function unfollowUser(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  await prisma.userFollow.deleteMany({
    where: { followerId: session.user.id, followingId: targetUserId },
  });

  revalidatePath(`/spelers/${targetUserId}`);
  return { success: true };
}
