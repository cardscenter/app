// Geschillen — constants en types.
//
// Apart bestand zodat client-componenten en non-async-exporten dit kunnen
// importeren (src/actions/dispute-v2.ts is "use server" en mag alleen async
// exports hebben — geen constants/types).
//
// Eén geschil-systeem sinds 2026-09-08 (het oude v1-model is verwijderd; de
// naam "V2" in model/bestand is historisch).

/** Koper mag pas een geschil openen vanaf N dagen na verzending (SHIPPED). */
export const DISPUTE_V2_OPEN_AFTER_DAYS = 10;
/** Geschil-venster op een SHIPPED-bundle: tot N dagen na verzending. */
export const DISPUTE_V2_WINDOW_DAYS = 30;
/**
 * Post-levering-venster: op een PLATFORM-bundle die al COMPLETED is (koper
 * bevestigde ontvangst, auto-confirm of ophaalcode) mag de koper nog N dagen
 * na `deliveredAt` een geschil openen — bv. namaak of verborgen schade die
 * pas bij nakijken opvalt. Escrow is dan al vrijgegeven; de refund komt uit
 * het verkopers-saldo (zie `fundingSource` op DisputeV2).
 */
export const DISPUTE_V2_POST_DELIVERY_DAYS = 14;
/** Verkoper moet binnen N dagen op een OPEN geschil reageren. */
export const DISPUTE_V2_RESPONSE_DAYS = 14;
/** Wederpartij moet binnen N dagen op een reactie/voorstel reageren. */
export const DISPUTE_V2_BUYER_REVIEW_DAYS = 14;
/** Admin-SLA na escalatie (alleen zichtbaar als flag, niet afdwingend). */
export const DISPUTE_V2_ADMIN_SLA_DAYS = 5;
/** Maximum aantal bewijsfoto's per partij (initieel + later toegevoegd). */
export const DISPUTE_V2_MAX_EVIDENCE_PER_PARTY = 12;

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

export const DISPUTE_V2_REASON_LABELS: Record<DisputeV2ReasonCategory, string> = {
  NOT_RECEIVED: "Niet ontvangen",
  NOT_AS_DESCRIBED: "Niet zoals beschreven",
  DAMAGED: "Beschadigd",
  WRONG_ITEM: "Verkeerd item",
  COUNTERFEIT_SUSPECTED: "Vermoeden van namaak",
  OTHER: "Anders",
};

export const DISPUTE_V2_RESOLUTIONS = [
  "FULL_REFUND",
  "PARTIAL_REFUND",
  "NO_REFUND",
  "RETURN_AND_REFUND",
] as const;
export type DisputeV2Resolution = (typeof DISPUTE_V2_RESOLUTIONS)[number];

export const DISPUTE_V2_RESOLUTION_LABELS: Record<DisputeV2Resolution, string> = {
  FULL_REFUND: "Volledige terugbetaling",
  PARTIAL_REFUND: "Gedeeltelijke terugbetaling",
  NO_REFUND: "Geen terugbetaling",
  RETURN_AND_REFUND: "Retour + volledige terugbetaling",
};

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

export const DISPUTE_V2_STATUS_LABELS: Record<DisputeV2Status, string> = {
  OPEN: "Open — wacht op verkoper",
  SELLER_RESPONDED: "Verkoper heeft gereageerd",
  MEDIATION: "Voorstel uitstaand",
  ESCALATED: "Bij de beheerder",
  RESOLVED_BUYER: "Afgerond — koper kreeg terugbetaling",
  RESOLVED_SELLER: "Afgerond — geen terugbetaling",
  RESOLVED_MUTUAL: "Afgerond — onderling akkoord",
  RESOLVED_ADMIN: "Afgerond — beslissing beheerder",
  CANCELLED: "Ingetrokken door koper",
};

// Hulp: welke statuses zijn "open" (kunnen nog acties krijgen)
export const DISPUTE_V2_OPEN_STATUSES: ReadonlySet<DisputeV2Status> = new Set([
  "OPEN",
  "SELLER_RESPONDED",
  "MEDIATION",
  "ESCALATED",
]);
export const DISPUTE_V2_OPEN_STATUS_LIST = ["OPEN", "SELLER_RESPONDED", "MEDIATION", "ESCALATED"] as const;

/** Waar een refund uit betaald wordt — zie schema-comment op DisputeV2. */
export type DisputeV2FundingSource = "ESCROW" | "SELLER_BALANCE";

/** Zichtbaarheid van admin-notities in de tijdlijn. */
export type DisputeV2NoteVisibility = "INTERNAL" | "PARTIES";
