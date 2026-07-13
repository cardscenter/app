import { prisma } from "@/lib/prisma";

/**
 * Harde e-mailverificatie-handhaving (Fase 42, aangescherpt in Fase 43).
 * Browsen, volglijst en het afronden/afbouwen van bestaande verplichtingen
 * (complete*Payment, REJECT/decline/withdraw, cancellations, pickups op
 * betaalde bundles, verzenden, disputes) blijven vrij; alle acties die NIEUWE
 * handel of communicatie initiëren zijn geguard: verkopen (create*),
 * kopen/bieden/claimen/checkout, voorstellen + accepteren, chatten en
 * uitbetalen. Storten is UI-side gegate op /dashboard/saldo. Spiegelt de
 * return-vorm van `requireNotSuspended` zodat de caller dezelfde
 * `if ("error" in x)`-check kan gebruiken.
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
        "Bevestig eerst je e-mailadres voordat je kunt kopen, bieden, claimen, chatten, verkopen of uitbetalen. Check je inbox of vraag een nieuwe verificatiemail aan in je dashboard.",
    };
  }
  return { ok: true };
}
