import { prisma } from "@/lib/prisma";

interface SuspensionFields {
  suspendedUntil: Date | null;
  suspensionType: string | null;
}

/**
 * A user is "suspended" when:
 *   - suspensionType is PERMANENT, OR
 *   - suspendedUntil is set and in the future.
 * Past `suspendedUntil` rows are treated as expired (no manual lift required).
 */
export function isUserSuspended(user: SuspensionFields): boolean {
  if (user.suspensionType === "PERMANENT") return true;
  if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) return true;
  return false;
}

/**
 * Throws a normalized error tag if the user is suspended. Use as the first
 * line of any action that creates content, places bids, sends messages, etc.
 * Allowed during suspension: payout requests, dispute responses, marking
 * shipments. Those actions skip this check.
 */
export async function requireNotSuspended(userId: string): Promise<{ ok: true } | { error: string }> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspendedUntil: true, suspensionType: true, suspensionReason: true },
  });
  if (!u) return { error: "Gebruiker niet gevonden" };
  if (isUserSuspended(u)) {
    if (u.suspensionType === "PERMANENT") {
      return { error: "Je account is permanent opgeschort. Neem contact op met support." };
    }
    const until = u.suspendedUntil!.toLocaleDateString("nl-NL");
    return {
      error: `Je account is opgeschort tot ${until}${u.suspensionReason ? ` (reden: ${u.suspensionReason})` : ""}.`,
    };
  }
  return { ok: true };
}

export const SUSPENSION_TYPES = ["TEMPORARY", "PERMANENT"] as const;
export type SuspensionType = (typeof SUSPENSION_TYPES)[number];

/**
 * System-driven suspend (Fase 29) — voor automatische cron-acties zoals
 * strike-thresholds bij wanbetaling. Schrijft direct in User en logt het
 * naar AdminAuditLog met `actorType="SYSTEM"`. Geen admin-guard, want het
 * is geen menselijke admin die dit triggert.
 *
 * Gebruik dit niet vanuit user-facing actions. Voor admin-driven suspends
 * blijft `suspendUser` in `src/actions/admin-suspension.ts` de juiste route.
 */
export async function suspendUserSystem(
  userId: string,
  type: SuspensionType,
  days: number | null,
  reason: string,
): Promise<void> {
  // Voor PERMANENT: zet datum ver in toekomst (zelfde patroon als admin-suspension)
  const suspendedUntil =
    type === "PERMANENT"
      ? new Date("2999-12-31T00:00:00.000Z")
      : days !== null
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      suspendedUntil,
      suspensionType: type,
      suspensionReason: reason,
      suspensionAdminId: null, // system-driven, geen admin
    },
  });

  // Lazy-import om circulaire dependency te vermijden (admin-audit gebruikt
  // prisma; suspension.ts wordt vroeg ingelezen door auth/middleware-paden).
  const { logAdminAction } = await import("@/lib/admin-audit");
  await logAdminAction({
    adminId: "system",
    action: "SYSTEM_AUTO_SUSPEND",
    targetType: "USER",
    targetId: userId,
    metadata: { type, days, reason },
  });

  // Real-time: dashboard-banner verschijnt direct bij user (Fase 30C).
  const { publish, userChannel } = await import("@/lib/realtime");
  publish(userChannel(userId), { type: "suspension-changed", payload: { suspended: true } });
}
