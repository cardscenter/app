// Shared IBAN validation utilities. Used by buyback (BuybackRequest.iban) and
// the user profile bank-details form (User.iban). The platform serves the
// whole EU (+ EER and UK) so every accepted country has its own exact length.

// Anti-fraud cooldown for changing a saved IBAN. A compromised account
// shouldn't be able to redirect payouts to an attacker's IBAN minutes after
// takeover. 30 days gives the legitimate owner time to notice and intervene.
export const IBAN_COOLDOWN_DAYS = 30;

// Country code → exact total IBAN length. Source: SWIFT IBAN Registry
// (https://www.swift.com/standards/data-standards/iban-international-bank-account-number).
// Covers EU + EER + Switzerland + UK + microstates that share EUR/SEPA.
const IBAN_COUNTRY_LENGTHS: Record<string, number> = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24,
  DE: 22, DK: 18, EE: 20, ES: 24, FI: 18, FO: 18, FR: 27,
  GB: 22, GI: 23, GL: 18, GR: 27, HR: 21, HU: 28, IE: 22,
  IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27,
  MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24,
  SI: 19, SK: 24, SM: 27,
};

const IBAN_FORMAT_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]+$/;

export function normalizeIban(input: string): string {
  return input.replace(/\s/g, "").toUpperCase();
}

/**
 * Mod-97 checksum per ISO 13616: rearrange so the country code + check
 * digits move to the end, replace letters with their A=10..Z=35 numeric
 * equivalents, then test that the resulting integer modulo 97 equals 1.
 * Catches the vast majority of typos that pass a length check.
 */
function passesMod97(normalized: string): boolean {
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const digit = code >= 65 && code <= 90 ? code - 55 : code - 48;
    if (digit < 0 || digit > 35) return false;
    remainder = (remainder * (digit > 9 ? 100 : 10) + digit) % 97;
  }
  return remainder === 1;
}

/**
 * Validate an IBAN: structural shape, supported country, exact country
 * length, and mod-97 checksum. Pass raw user input — we normalize for you.
 */
export function isValidIbanFormat(input: string): boolean {
  const n = normalizeIban(input);
  if (!IBAN_FORMAT_REGEX.test(n)) return false;
  const country = n.slice(0, 2);
  const expectedLength = IBAN_COUNTRY_LENGTHS[country];
  if (!expectedLength || n.length !== expectedLength) return false;
  return passesMod97(n);
}

/**
 * Returns the list of supported country codes (handy for displaying a hint
 * in the UI when the user picks an unsupported country).
 */
export function getSupportedIbanCountries(): string[] {
  return Object.keys(IBAN_COUNTRY_LENGTHS).sort();
}

/**
 * Visual-friendly grouping for display: "NL91ABNA0417164300" → "NL91 ABNA 0417 1643 00".
 * Does not validate; pass an already-validated IBAN.
 */
export function formatIbanForDisplay(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Mask all but the country prefix and last 4 chars: "NL91 **** **** 4300".
 * Used in places where we display an IBAN without exposing the full account.
 */
export function maskIban(iban: string): string {
  const n = normalizeIban(iban);
  if (n.length <= 8) return n;
  return `${n.slice(0, 4)} **** ${n.slice(-4)}`;
}
