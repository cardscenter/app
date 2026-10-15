import "server-only";
import { prisma } from "@/lib/prisma";

export type GuardianConsentResult =
  | { ok: true; childDisplayName: string; alreadyGiven: boolean }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Verzilvert een ouder-toestemmingstoken (Community Hub, Fase 2). Claim-first
 * (updateMany op usedAt) zodat een dubbele klik niet dubbel telt. Een al
 * gebruikt token van dezelfde ouder toont gewoon "toestemming staat".
 */
export async function applyGuardianConsent(token: string | null | undefined): Promise<GuardianConsentResult> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: "invalid" };

  const row = await prisma.guardianConsentToken.findUnique({
    where: { token },
    select: { id: true, userId: true, guardianEmail: true, expiresAt: true, usedAt: true, user: { select: { displayName: true, guardianConsentAt: true, guardianEmail: true } } },
  });
  if (!row) return { ok: false, reason: "invalid" };

  if (row.usedAt) {
    // Al verzilverd: als de toestemming nog staat, bevestigend tonen.
    if (row.user.guardianConsentAt && row.user.guardianEmail === row.guardianEmail) {
      return { ok: true, childDisplayName: row.user.displayName, alreadyGiven: true };
    }
    return { ok: false, reason: "expired" };
  }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  // Ouder-adres is sinds de mail gewijzigd: deze link hoort bij een ander adres.
  if (row.user.guardianEmail !== row.guardianEmail) return { ok: false, reason: "expired" };

  const now = new Date();
  const claimed = await prisma.guardianConsentToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return { ok: false, reason: "expired" };

  await prisma.user.update({ where: { id: row.userId }, data: { guardianConsentAt: now } });
  return { ok: true, childDisplayName: row.user.displayName, alreadyGiven: false };
}
