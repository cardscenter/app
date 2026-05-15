/**
 * Verzending-thresholds (Fase 33).
 *
 * Briefpost (untracked) is geschrapt — alle service-types zijn nu getracked.
 * Cross-border-altijd-signed-regel is vervallen: PARCEL_STANDARD mag in EU_NEAR/EU_FAR
 * onder €150. Boven €150 is SIGNED verplicht in alle zones.
 */

export const SIGNED_RECOMMENDED_THRESHOLD = 75;
export const SIGNED_REQUIRED_THRESHOLD = 150;

/** Boven deze drempel is alleen PARCEL_SIGNED toegestaan, ongeacht zone. */
export function requiresSignedShipping(orderValue: number): boolean {
  return orderValue >= SIGNED_REQUIRED_THRESHOLD;
}

export function recommendsSignedShipping(orderValue: number): boolean {
  return orderValue >= SIGNED_RECOMMENDED_THRESHOLD;
}
