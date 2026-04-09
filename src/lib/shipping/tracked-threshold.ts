export const SIGNED_RECOMMENDED_THRESHOLD = 75; // binnenlands
export const SIGNED_REQUIRED_THRESHOLD = 150; // binnenlands
export const UNTRACKED_MAX_ORDER_VALUE = 25; // briefpost max bedrag
export const LETTER_MAX_ITEMS = 10; // max kaarten per brief

export function requiresSignedShipping(
  orderValue: number,
  isInternational: boolean
): boolean {
  if (isInternational) return true;
  return orderValue >= SIGNED_REQUIRED_THRESHOLD;
}

export function recommendsSignedShipping(orderValue: number): boolean {
  return orderValue >= SIGNED_RECOMMENDED_THRESHOLD;
}

export function isUntrackedAllowed(orderValue: number): boolean {
  return orderValue < UNTRACKED_MAX_ORDER_VALUE;
}
