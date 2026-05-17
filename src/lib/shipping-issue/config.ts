// ShippingIssue — constants en types (Fase 40).
// Apart bestand zodat client-componenten + non-async-exports beschikbaar zijn.

export const SHIPPING_ISSUE_TYPES = [
  "TRACKING_STUCK",       // "in transit" > 14d zonder update
  "NO_SCAN_UPDATE",       // pakket was eens "in transit" maar tracking is gestopt
  "WRONG_DELIVERY",       // bezorgd op verkeerd adres
  "OTHER",                // vrije tekst
] as const;
export type ShippingIssueType = (typeof SHIPPING_ISSUE_TYPES)[number];

export const SHIPPING_ISSUE_STATUSES = [
  "OPEN",
  "INVESTIGATING",
  "RESOLVED_GOODWILL",
  "RESOLVED_NO_ACTION",
  "ESCALATED_TO_DISPUTE",
] as const;
export type ShippingIssueStatus = (typeof SHIPPING_ISSUE_STATUSES)[number];

// Maximum goodwill-refund vanuit platform-pot. Boven dit bedrag: escaleren
// naar DisputeV2 zodat seller-escrow ook geraakt wordt.
export const GOODWILL_REFUND_MAX = 50;

// Hoeveel dagen sinds SHIPPED voordat buyer een ticket mag openen
export const SHIPPING_ISSUE_OPEN_AFTER_DAYS = 14;

export const SHIPPING_ISSUE_TYPE_LABELS: Record<ShippingIssueType, string> = {
  TRACKING_STUCK: "Tracking blijft hangen",
  NO_SCAN_UPDATE: "Geen scan-update meer",
  WRONG_DELIVERY: "Verkeerd adres bezorgd",
  OTHER: "Anders",
};
