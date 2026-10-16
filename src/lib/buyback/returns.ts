import "server-only";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";

/**
 * Betaalstatus van een retour-betaling (Payment.purpose BUYBACK_RETURN),
 * aangeroepen vanuit `applyPaymentStatus`. Idempotent: de flip naar
 * RETURN_REQUESTED gebeurt alleen vanuit PARTIALLY_APPROVED/REJECTED zonder
 * eerdere keuze.
 */
export async function onBuybackReturnPaymentStatus(paymentId: string, status: string, now: Date): Promise<void> {
  const request = await prisma.buybackRequest.findUnique({ where: { returnPaymentId: paymentId }, select: { id: true, userId: true, status: true, userDecision: true } });
  if (!request) return;
  if (status !== "PAID") return; // open/mislukt: verkoper kan opnieuw proberen, niets flippen
  const flipped = await prisma.buybackRequest.updateMany({
    where: { id: request.id, status: { in: ["PARTIALLY_APPROVED", "REJECTED"] }, userDecision: null },
    data: { status: "RETURN_REQUESTED", userDecision: "RETURN", userDecidedAt: now },
  });
  if (flipped.count !== 1) return;
  await createNotification(request.userId, "BUYBACK_RETURN_REQUESTED", "Retourkosten ontvangen", "We sturen je kaarten binnen enkele werkdagen terug. Je krijgt een melding met de Track & Trace.", `/dashboard/inkoop/${request.id}`);
  const admins = await prisma.user.findMany({ where: { accountType: "ADMIN" }, select: { id: true } });
  for (const a of admins) await createNotification(a.id, "ADMIN_TASK", "Retour inkoop betaald", "Een verkoper heeft retourkosten betaald. Stuur de kaarten terug en vul de Track & Trace in.", `/dashboard/admin/buybacks/${request.id}`);
}
