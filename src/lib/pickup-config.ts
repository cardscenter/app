// Constants voor pickup-flow (Fase 27). Apart bestand zodat client-componenten
// ze mogen importeren — `pickup.ts` heeft "use server" en mag alleen async exports.

export const PICKUP_CODE_LENGTH = 4;
export const PICKUP_CODE_MAX_ATTEMPTS = 5;
export const PICKUP_LOCKOUT_HOURS = 1;
export const PICKUP_REMINDER_HOURS = 24;

// Genereer een 4-cijferige numerieke code, leading zeros behouden.
export function generatePickupCode(): string {
  const max = Math.pow(10, PICKUP_CODE_LENGTH);
  return Math.floor(Math.random() * max).toString().padStart(PICKUP_CODE_LENGTH, "0");
}
