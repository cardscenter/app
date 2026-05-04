// Constants voor cancellation-flow. Apart bestand zodat client-componenten
// ze mogen importeren — `cancellation.ts` heeft "use server" en mag alleen
// async exports hebben.
//
// Vanaf Fase 28: directe-annulering bestaat niet meer. Beide partijen
// gebruiken altijd `requestCancellation` (cancellation.ts) → wederpartij
// accepteert/wijst af, 7 dagen deadline.

export const CANCELLATION_DEADLINE_DAYS = 7;

export const CANCELLATION_REASONS = [
  "BUYER_CHANGED_MIND",
  "SELLER_OUT_OF_STOCK",
  "DAMAGED",
  "UNRESPONSIVE",
  "OTHER",
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];
