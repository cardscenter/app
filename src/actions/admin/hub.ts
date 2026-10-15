"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { createNotification } from "@/actions/notification";
import { isRole, ROLE_LABELS, type Role } from "@/lib/roles";
import { ensureGameOptions } from "@/lib/games-server";

/**
 * Admin-acties van de Community Hub (Fase 2): rollen en spellen.
 * Patroon: requireAdmin → schrijven → logAdminAction (zie CLAUDE.md).
 */

export async function setUserRole(userId: string, role: string) {
  const { adminId } = await requireAdmin();
  if (!isRole(role)) return { error: "Onbekende rol" };
  if (userId === adminId) return { error: "Je kunt je eigen rol niet wijzigen" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, accountType: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return { error: "Gebruiker niet gevonden" };
  // ADMIN loopt via accountType (2FA-plicht, requireAdmin); de rol ADMIN
  // alleen zetten via de bestaande tier-/admin-flow, niet hier.
  if (role === "ADMIN" || user.accountType === "ADMIN") {
    return { error: "Admin-rechten regel je via het accounttype, niet via de rol" };
  }
  if (user.role === role) return { success: true };

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await logAdminAction({
    adminId,
    action: "SET_USER_ROLE",
    targetType: "USER",
    targetId: userId,
    metadata: { from: user.role, to: role },
  });
  await createNotification(
    userId,
    "ACCOUNT_UPDATE",
    role === "STAFF" ? "Je bent nu staff" : "Je staff-rol is ingetrokken",
    role === "STAFF"
      ? "Je kunt vanaf nu inchecken bij evenementen en bestellingen verwerken."
      : "Je account is weer een gewoon spelersaccount.",
    "/dashboard",
  );
  revalidatePath(`/dashboard/admin/users/${userId}`);
  return { success: true, label: ROLE_LABELS[role as Role] };
}

export async function toggleGameOption(key: string, enabled: boolean) {
  const { adminId } = await requireAdmin();
  await ensureGameOptions();
  const game = await prisma.gameOption.findUnique({ where: { key } });
  if (!game) return { error: "Onbekend spel" };
  if (game.enabled === enabled) return { success: true };

  await prisma.gameOption.update({ where: { key }, data: { enabled } });
  await logAdminAction({
    adminId,
    action: "TOGGLE_GAME",
    targetType: "GAME",
    targetId: key,
    metadata: { enabled },
  });
  revalidatePath("/dashboard/admin/games");
  revalidatePath("/dashboard/profiel");
  return { success: true };
}
