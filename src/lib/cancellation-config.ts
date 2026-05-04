// Constants voor cancellation-flow. Apart bestand zodat client-componenten
// ze mogen importeren — `cancellation.ts` heeft "use server" en mag alleen
// async exports hebben.
//
// Vanaf Fase 28: directe-annulering bestaat niet meer. Beide partijen
// gebruiken altijd `requestCancellation` (cancellation.ts) → wederpartij
// accepteert/wijst af, 7 dagen deadline.

export const CANCELLATION_DEADLINE_DAYS = 7;

// Geldige redenen voor een annuleringsverzoek. "Koper bedacht zich" is bewust
// niet beschikbaar — een PAID-bundle is een bindende overeenkomst en is geen
// geldige reden om unilateraal te annuleren. Voor échte koper-correcties
// (verkeerd item, dubbel besteld) gebruikt de koper "OTHER" met toelichting.
export const CANCELLATION_REASONS = [
  "SELLER_OUT_OF_STOCK",
  "DAMAGED",
  "SHIPPING_NOT_POSSIBLE",
  "UNRESPONSIVE",
  "OTHER",
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];
