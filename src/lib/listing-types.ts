// Shared types voor listing-flows die zowel server-actions als client-componenten
// nodig hebben. Apart bestand omdat `"use server"` files alleen async exports
// mogen hebben — TypeScript-types daarin breken Next.js' analyser.

// DeliveryChoice (Fase 27.39): hoe de koper het product wil ontvangen + betalen.
// SHIP = verzenden via PLATFORM-escrow (default).
// PICKUP_PLATFORM = ophalen, vooraf betalen via wallet (escrow + code-confirm).
// PICKUP_EXTERNAL = ophalen, betalen aan seller bij ophalen (Tikkie/contant);
//   geen escrow, koper-confirm met 1 klik.
export type DeliveryChoice = "SHIP" | "PICKUP_PLATFORM" | "PICKUP_EXTERNAL";

/** MAILBOX_PARCEL is alleen toegestaan voor losse-kaart en kaart-bundel listings.
 *  Brievenbuspakketten passen niet voor sealed/collection/overig (volume + risico). */
export function mailboxEligibleType(t: string): boolean {
  return t === "SINGLE_CARD" || t === "MULTI_CARD";
}
