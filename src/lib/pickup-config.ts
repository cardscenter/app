// Constants voor pickup-flow (Fase 27). Apart bestand zodat client-componenten
// ze mogen importeren — `pickup.ts` heeft "use server" en mag alleen async exports.

export const PICKUP_CODE_DIGITS = 4;
// Hoofdletters zonder O en I (lijken op 0 en 1) — voorkomt voorlees-fouten
// bij ophalen. 24 mogelijke letters × 10000 cijfers = 240.000 codes.
export const PICKUP_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const PICKUP_CODE_LENGTH = PICKUP_CODE_DIGITS + 1;
// Regex voor validatie en UI-input — exact 4 cijfers gevolgd door 1 toegestane hoofdletter.
export const PICKUP_CODE_REGEX = /^\d{4}[ABCDEFGHJKLMNPQRSTUVWXYZ]$/;

export const PICKUP_CODE_MAX_ATTEMPTS = 5;
export const PICKUP_LOCKOUT_HOURS = 1;
export const PICKUP_REMINDER_HOURS = 24;

// Genereer een 4-cijferige numerieke code + 1 hoofdletter (geen O/I). Gebruikt
// crypto.getRandomValues voor uniforme verdeling — Math.random heeft modulo-bias
// op kleine reeksen wat patronen voorspelbaar zou maken voor partijen die
// pickup-codes proberen te raden.
export function generatePickupCode(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const digits = (buf[0] % 10000).toString().padStart(PICKUP_CODE_DIGITS, "0");
  const letter = PICKUP_CODE_LETTERS[buf[1] % PICKUP_CODE_LETTERS.length];
  return `${digits}${letter}`;
}
