// Constants voor pickup-flow (Fase 27). Apart bestand zodat client-componenten
// ze mogen importeren — `pickup.ts` heeft "use server" en mag alleen async exports.

export const PICKUP_CODE_DIGITS = 4;
// Hoofdletters zonder O en I (lijken op 0 en 1) — voorkomt voorlees-fouten
// bij ophalen. 24 mogelijke letters × 10000 cijfers = 240.000 codes.
export const PICKUP_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const PICKUP_CODE_LENGTH = PICKUP_CODE_DIGITS + 1;
// Regex voor validatie en UI-input — exact 4 cijfers gevolgd door 1 toegestane hoofdletter.
export const PICKUP_CODE_REGEX = /^\d{4}[ABCDEFGHJKLMNPQRSTUVWXYZ]$/;

// Detectie van pickup-code-patroon in vrije tekst (bv. chat-bericht).
// Lenient — vangt deze varianten:
//   "4976T", "4976t", "4976 T", "4976-T", "4976.T", "4 9 7 6 T",
//   "code: 4976t", "Hier 4976 t alstublieft"
// Maar NIET:
//   "abc4976text" (cijfer-letter-blok in een woord)
//   "0123456789" (geen letter)
//   "1234A" als deel van een UUID/code (lookbehind blokkeert dat)
//
// Lookarounds: voor het pattern mag geen [A-Z0-9] staan, na de letter ook niet.
// Tussen cijfers + voor de letter mag 0-2 separator-chars (spatie/streep/punt).
// Case-insensitive (we normaliseren niet, om geen false positives te krijgen
// op willekeurige cijfer-reeksen — alleen het 4+1 patroon wordt geraakt).
export const PICKUP_CODE_DETECT_REGEX =
  /(?<![A-Z0-9])\d[\s\-.,]{0,2}\d[\s\-.,]{0,2}\d[\s\-.,]{0,2}\d[\s\-.,]{0,2}[A-HJ-NP-Z](?![A-Z0-9])/i;

export function containsPickupCodeShape(text: string): boolean {
  return PICKUP_CODE_DETECT_REGEX.test(text);
}

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
