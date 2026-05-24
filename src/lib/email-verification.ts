import { prisma } from "@/lib/prisma";

/**
 * Zachte e-mailverificatie-handhaving (Fase 42). Browsen en kopen blijft vrij;
 * deze guard wordt alleen vóór geld-/verkoop-acties geplaatst (createListing,
 * createAuction, createClaimsale, requestWithdrawal). Spiegelt de return-vorm
 * van `requireNotSuspended` zodat de caller dezelfde `if ("error" in x)`-check
 * kan gebruiken.
 */
export async function requireEmailVerified(
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  if (!u) return { error: "Gebruiker niet gevonden" };
  if (!u.emailVerifiedAt) {
    return {
      error:
        "Bevestig eerst je e-mailadres voordat je kunt verkopen of uitbetalen. Check je inbox of vraag een nieuwe verificatiemail aan in je dashboard.",
    };
  }
  return { ok: true };
}
