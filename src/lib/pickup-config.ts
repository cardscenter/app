// Constants voor pickup-flow (Fase 27). Apart bestand zodat client-componenten
// ze mogen importeren — `pickup.ts` heeft "use server" en mag alleen async exports.

// Hoofdletters zonder O en I (lijken op 0 en 1) — voorkomt voorlees-fouten.
export const PICKUP_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
// Format LCLCC (Fase 27.77): Letter, Cijfer, Letter, Cijfer, Cijfer.
// Voorbeeld: "N3L97". Lijkt niet op een Nederlandse postcode (4 cijfers + 2
// letters), wat false-positives in chat-detectie sterk verlaagt.
// 24 × 10 × 24 × 10 × 10 = 576.000 mogelijkheden — meer dan voldoende
// security met 5-attempts lockout + 1u cooldown.
export const PICKUP_CODE_LENGTH = 5;
export const PICKUP_CODE_REGEX = /^[ABCDEFGHJKLMNPQRSTUVWXYZ]\d[ABCDEFGHJKLMNPQRSTUVWXYZ]\d\d$/;

// Detectie van pickup-code-patroon in vrije tekst (bv. chat-bericht).
// Lookarounds voorkomen matches binnen woorden of langere alfanumerieke
// reeksen. Optionele separators (max 2) tussen elke positie zodat 'N 3 L 9 7'
// of 'N3-L97' ook detecteerbaar zijn. Geen postcode-conflict want LCLCC is
// een ongebruikelijk patroon in dagelijkse Nederlandse tekst.
export const PICKUP_CODE_DETECT_REGEX =
  /(?<![A-Z0-9])[A-HJ-NP-Z][\s\-.,]{0,2}\d[\s\-.,]{0,2}[A-HJ-NP-Z][\s\-.,]{0,2}\d[\s\-.,]{0,2}\d(?![A-Z0-9])/i;

export function containsPickupCodeShape(text: string): boolean {
  return PICKUP_CODE_DETECT_REGEX.test(text);
}

export const PICKUP_CODE_MAX_ATTEMPTS = 5;
export const PICKUP_LOCKOUT_HOURS = 1;
export const PICKUP_REMINDER_HOURS = 24;

// Genereer een pickup-code in LCLCC-format. Gebruikt crypto.getRandomValues
// voor uniforme verdeling — Math.random heeft modulo-bias op kleine reeksen
// wat patronen voorspelbaar zou maken voor partijen die pickup-codes proberen
// te raden.
export function generatePickupCode(): string {
  const buf = new Uint32Array(5);
  crypto.getRandomValues(buf);
  const L = PICKUP_CODE_LETTERS;
  return [
    L[buf[0] % L.length],
    (buf[1] % 10).toString(),
    L[buf[2] % L.length],
    (buf[3] % 10).toString(),
    (buf[4] % 10).toString(),
  ].join("");
}
