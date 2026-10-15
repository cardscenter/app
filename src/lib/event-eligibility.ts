import "server-only";
import { prisma } from "@/lib/prisma";
import { isMinor } from "./age";

export type BookingEligibility =
  | { ok: true; minor: boolean }
  | { ok: false; reason: "email" | "dob" | "guardian" | "deleted"; error: string };

/**
 * Mag dit account (betaalde) evenementen boeken? (Community Hub, Fase 2;
 * gebruikt door de boekingsflow in Fase 3.) Eisen: e-mail geverifieerd,
 * geboortedatum ingevuld, en onder de 16 een bevestigde ouder-toestemming.
 */
export async function getBookingEligibility(userId: string): Promise<BookingEligibility> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true, dateOfBirth: true, guardianConsentAt: true, deletedAt: true },
  });
  if (!u || u.deletedAt) return { ok: false, reason: "deleted", error: "Account niet gevonden" };
  if (!u.emailVerifiedAt) {
    return { ok: false, reason: "email", error: "Bevestig eerst je e-mailadres voordat je een evenement boekt." };
  }
  if (!u.dateOfBirth) {
    return { ok: false, reason: "dob", error: "Vul eerst je geboortedatum in op je profiel. Die bepaalt je leeftijdsdivisie." };
  }
  const minor = isMinor(u.dateOfBirth);
  if (minor && !u.guardianConsentAt) {
    return { ok: false, reason: "guardian", error: "Je ouder of verzorger moet eerst toestemming geven. Regel dat op je profiel." };
  }
  return { ok: true, minor };
}
