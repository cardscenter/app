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
