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
// geldige reden om unilateraal te annuleren.
//
// Buyer en seller hebben aparte redenen want de scenario's verschillen
// fundamenteel: koper kan niet "out of stock" zijn, verkoper kan niet "verkeerd
// item gekocht". CANCELLATION_REASONS is de union voor schema-validatie.

export const BUYER_CANCELLATION_REASONS = [
  "BUYER_WRONG_ITEM",        // verkeerd item geselecteerd / typo bij checkout
  "BUYER_DUPLICATE",         // per ongeluk dubbel besteld
  "BUYER_SELLER_UNRESPONSIVE", // verkoper reageert niet op vragen
  "OTHER",
] as const;

export const SELLER_CANCELLATION_REASONS = [
  "SELLER_OUT_OF_STOCK",          // item bleek toch verkocht / niet meer beschikbaar
  "SELLER_DAMAGED",               // schade ontdekt bij inpakken
  "SELLER_SHIPPING_NOT_POSSIBLE", // vakantie/ziekte/printer kapot — kan tijdelijk niet verzenden
  "SELLER_BUYER_UNRESPONSIVE",    // koper reageert niet op vragen (adres etc.)
  "OTHER",
] as const;

export const CANCELLATION_REASONS = [
  ...BUYER_CANCELLATION_REASONS,
  ...SELLER_CANCELLATION_REASONS,
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];
export type BuyerCancellationReason = (typeof BUYER_CANCELLATION_REASONS)[number];
export type SellerCancellationReason = (typeof SELLER_CANCELLATION_REASONS)[number];
