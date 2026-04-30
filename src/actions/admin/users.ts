"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { createNotification } from "@/actions/notification";

export async function resetIbanCooldown(userId: string) {
  const { adminId } = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, lastIbanChange: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  await prisma.user.update({
    where: { id: userId },
    data: { lastIbanChange: null },
  });

  await logAdminAction({
    adminId,
    action: "RESET_IBAN_COOLDOWN",
    targetType: "USER",
    targetId: userId,
    metadata: { userName: user.displayName, previousLastIbanChange: user.lastIbanChange?.toISOString() ?? null },
  });

  return { success: true };
}

export async function forceUsernameReset(userId: string) {
  const { adminId } = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, lastUsernameChange: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  await prisma.user.update({
    where: { id: userId },
    data: { lastUsernameChange: null },
  });

  await logAdminAction({
    adminId,
    action: "FORCE_USERNAME_RESET",
    targetType: "USER",
    targetId: userId,
    metadata: { userName: user.displayName, previousLastUsernameChange: user.lastUsernameChange?.toISOString() ?? null },
  });

  await createNotification(
    userId,
    "NEW_MESSAGE",
    "Username-cooldown gereset",
    "Een admin heeft je username-cooldown gereset. Je kunt nu opnieuw je gebruikersnaam wijzigen.",
    "/dashboard/profiel"
  );

  return { success: true };
}
