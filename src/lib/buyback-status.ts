/**
 * Statusmachine van de inkoop (Community Hub, Fase 6). Puur bestand, ook door
 * client-componenten importeerbaar.
 *
 * PENDING (aangevraagd) → RECEIVED (ontvangen) → INSPECTING (wordt gecontroleerd)
 *   → APPROVED (gecontroleerd, klopt)            → PAID
 *   → PARTIALLY_APPROVED (aangepaste berekening) → verkoper kiest ACCEPT → PAID
 *                                                 → verkoper kiest RETURN + betaalt → RETURN_REQUESTED → RETURNED → PAID
 *   → REJECTED (alles afgekeurd)                 → verkoper kiest RETURN + betaalt → RETURN_REQUESTED → RETURNED
 * PENDING → CANCELLED (verkoper, vóór verzending)
 *
 * Zonder keuze vóór `decisionDeadline` (DECISION_DAYS na controle) mag de
 * winkel uitbetalen (PARTIALLY_APPROVED = stilzwijgend akkoord) en vervallen
 * afgekeurde kaarten aan de winkel (REJECTED). Staat zo in de voorwaarden.
 */

export const RETURN_FEE_EUR = 10.95;
export const DECISION_DAYS = 14;

export const BUYBACK_STATUSES = [
  "PENDING",
  "RECEIVED",
  "INSPECTING",
  "APPROVED",
  "PARTIALLY_APPROVED",
  "REJECTED",
  "RETURN_REQUESTED",
  "RETURNED",
  "PAID",
  "CANCELLED",
] as const;
export type BuybackStatus = (typeof BUYBACK_STATUSES)[number];

/** Overgangen die een admin handmatig mag zetten. Systeem-overgangen (retour betaald) staan apart. */
export const ADMIN_TRANSITIONS: Record<string, BuybackStatus[]> = {
  PENDING: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["INSPECTING"],
  INSPECTING: ["APPROVED", "PARTIALLY_APPROVED", "REJECTED"],
  APPROVED: ["PAID"],
  PARTIALLY_APPROVED: ["PAID"],
  RETURN_REQUESTED: ["RETURNED"],
  RETURNED: ["PAID"],
};

export function isTerminalStatus(status: string): boolean {
  return status === "PAID" || status === "CANCELLED" || (status === "RETURNED");
}

/** Mag de verkoper nog een keuze maken (akkoord/retour)? */
export function awaitsSellerDecision(r: { status: string; userDecision: string | null }): boolean {
  return (r.status === "PARTIALLY_APPROVED" || r.status === "REJECTED") && !r.userDecision;
}

/** Retour aanvragen kan bij aangepaste berekening én bij afkeur, zolang er geen keuze is. */
export function canRequestReturn(r: { status: string; userDecision: string | null }): boolean {
  return awaitsSellerDecision(r);
}

/** Akkoord met de nieuwe berekening: alleen bij PARTIALLY_APPROVED. */
export function canAcceptAdjusted(r: { status: string; userDecision: string | null }): boolean {
  return r.status === "PARTIALLY_APPROVED" && !r.userDecision;
}

/**
 * Mag de admin "uitbetaald" zetten? APPROVED altijd; PARTIALLY_APPROVED na
 * akkoord van de verkoper of na de beslistermijn; RETURNED alleen als er nog
 * iets uit te betalen is.
 */
export function canMarkPaid(
  r: { status: string; userDecision: string | null; decisionDeadline: Date | string | null; finalPayout: number | null; estimatedPayout: number },
  now: Date = new Date(),
): { ok: boolean; reason?: string } {
  if (r.status === "APPROVED") return { ok: true };
  if (r.status === "PARTIALLY_APPROVED") {
    if (r.userDecision === "ACCEPT") return { ok: true };
    if (r.userDecision === "RETURN") return { ok: false, reason: "Verkoper koos retour; verwerk eerst de retourzending." };
    const deadline = r.decisionDeadline ? new Date(r.decisionDeadline) : null;
    if (deadline && deadline <= now) return { ok: true };
    return { ok: false, reason: `Wacht op akkoord van de verkoper${deadline ? ` (uiterlijk ${deadline.toLocaleDateString("nl-NL")})` : ""}.` };
  }
  if (r.status === "RETURNED") {
    const payout = r.finalPayout ?? 0;
    return payout > 0 ? { ok: true } : { ok: false, reason: "Niets uit te betalen na retour." };
  }
  return { ok: false, reason: "Niet in een status waarin uitbetalen kan." };
}

export const BUYBACK_STATUS_LABEL_NL: Record<BuybackStatus, string> = {
  PENDING: "Aangevraagd",
  RECEIVED: "Ontvangen",
  INSPECTING: "Wordt gecontroleerd",
  APPROVED: "Gecontroleerd",
  PARTIALLY_APPROVED: "Aangepaste berekening",
  REJECTED: "Afgekeurd",
  RETURN_REQUESTED: "Retour betaald",
  RETURNED: "Retour verzonden",
  PAID: "Uitbetaald",
  CANCELLED: "Geannuleerd",
};

export function decisionDeadlineFrom(inspectedAt: Date): Date {
  return new Date(inspectedAt.getTime() + DECISION_DAYS * 24 * 3600_000);
}
