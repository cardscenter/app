// Dispute v2 — constants en types (Fase 40).
//
// Apart bestand zodat client-componenten en non-async-exporten dit kunnen
// importeren (src/actions/dispute-v2.ts is "use server" en mag alleen async
// exports hebben — geen constants/types).

export const DISPUTE_V2_OPEN_AFTER_DAYS = 10;
export const DISPUTE_V2_WINDOW_DAYS = 30;
export const DISPUTE_V2_RESPONSE_DAYS = 14;
export const DISPUTE_V2_BUYER_REVIEW_DAYS = 14;
export const DISPUTE_V2_ADMIN_SLA_DAYS = 5;

// 6 categorieën — keep aligned met de admin-page filters + i18n keys.
export const DISPUTE_V2_REASON_CATEGORIES = [
  "NOT_RECEIVED",
  "NOT_AS_DESCRIBED",
  "DAMAGED",
  "WRONG_ITEM",
  "COUNTERFEIT_SUSPECTED",
  "OTHER",
] as const;
export type DisputeV2ReasonCategory = (typeof DISPUTE_V2_REASON_CATEGORIES)[number];

export const DISPUTE_V2_RESOLUTIONS = [
  "FULL_REFUND",
  "PARTIAL_REFUND",
  "NO_REFUND",
  "RETURN_AND_REFUND",
] as const;
export type DisputeV2Resolution = (typeof DISPUTE_V2_RESOLUTIONS)[number];

// Status-flow van DisputeV2.status
export const DISPUTE_V2_STATUSES = [
  "OPEN",
  "SELLER_RESPONDED",
  "MEDIATION",
  "ESCALATED",
  "RESOLVED_BUYER",
  "RESOLVED_SELLER",
  "RESOLVED_MUTUAL",
  "RESOLVED_ADMIN",
  "CANCELLED",
] as const;
export type DisputeV2Status = (typeof DISPUTE_V2_STATUSES)[number];

// Hulp: welke statuses zijn "open" (kunnen nog acties krijgen)
export const DISPUTE_V2_OPEN_STATUSES: ReadonlySet<DisputeV2Status> = new Set([
  "OPEN",
  "SELLER_RESPONDED",
  "MEDIATION",
  "ESCALATED",
]);
