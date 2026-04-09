export const SIGNED_RECOMMENDED_THRESHOLD = 75; // binnenlands
export const SIGNED_REQUIRED_THRESHOLD = 150; // binnenlands

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
