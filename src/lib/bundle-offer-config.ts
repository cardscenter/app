// Constants voor bundle-offer flow (Fase 27). In een apart bestand zodat
// client-componenten ze mogen importeren — `bundle-offer.ts` heeft "use server"
// en mag alleen async exports hebben.

export const BUNDLE_OFFER_EXPIRY_DAYS = 3;
export const MIN_LISTINGS_PER_BUNDLE = 2;
export const MAX_LISTINGS_PER_BUNDLE = 20;

// Payment-deadline na seller-accept met partial balance (PLATFORM only).
export const BUNDLE_PAYMENT_DEADLINE_DAYS_SHIP = 5;

// Reservation-timeout voor EXTERNAL pickup-bundles (geen escrow, off-platform
// betaling). Cron `pickup-reservation-timeout` ruimt op zodat listings niet
// eeuwig vastzitten.
export const PICKUP_RESERVATION_DAYS = 5;

// Counter-bod-keten cap.
export const MAX_COUNTER_DEPTH = 5;
