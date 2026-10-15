/**
 * Leeftijd en leeftijdsregels (Community Hub, Fase 2). Puur bestand.
 *
 * - Onder de 16: AVG-toestemming van een ouder nodig vóór boeken/betalen, en
 *   een telefoonnummer van een ouder of noodcontact.
 * - Onder de 12: alleen met begeleiding van een volwassene (vinkt de boeker
 *   expliciet aan, Fase 3).
 * - De geboortedatum zelf is nooit publiek; alleen de divisie.
 */

export const GUARDIAN_CONSENT_AGE = 16;
export const SUPERVISION_AGE = 12;

/** Volle jaren tussen geboortedatum en `at` (default nu). */
export function ageOn(dateOfBirth: Date, at: Date = new Date()): number {
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (at.getUTCMonth() === dateOfBirth.getUTCMonth() && at.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

export function isMinor(dateOfBirth: Date, at: Date = new Date()): boolean {
  return ageOn(dateOfBirth, at) < GUARDIAN_CONSENT_AGE;
}

export function needsSupervision(dateOfBirth: Date, at: Date = new Date()): boolean {
  return ageOn(dateOfBirth, at) < SUPERVISION_AGE;
}

/** Leeftijdsdivisie op basis van geboortejaar (Play! Pokémon-stijl). */
export type AgeDivisionRule = {
  key: string;
  label: string;
  /** Geboren in of na dit jaar (inclusief). */
  minBirthYear?: number;
  /** Geboren in of voor dit jaar (inclusief). */
  maxBirthYear?: number;
};

/**
 * Pokémon-defaults voor seizoen 2026-2027 (Junior: geboren 2015 of later,
 * Senior: 2011-2014, Masters: 2010 of eerder). Per event-type instelbaar in
 * Fase 3; dit zijn alleen de vooringevulde waarden.
 */
export const POKEMON_DIVISIONS_2027: AgeDivisionRule[] = [
  { key: "junior", label: "Junior", minBirthYear: 2015 },
  { key: "senior", label: "Senior", minBirthYear: 2011, maxBirthYear: 2014 },
  { key: "masters", label: "Masters", maxBirthYear: 2010 },
];

export function divisionFor(dateOfBirth: Date, rules: AgeDivisionRule[]): AgeDivisionRule | null {
  const year = dateOfBirth.getUTCFullYear();
  return (
    rules.find(
      (r) => (r.minBirthYear === undefined || year >= r.minBirthYear) && (r.maxBirthYear === undefined || year <= r.maxBirthYear),
    ) ?? null
  );
}

/** "YYYY-MM-DD" (uit een date-input) → Date op UTC-middernacht, of null. */
export function parseDateOfBirth(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  // Round-trip-check vangt 31 februari e.d.
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return d;
}

/** Geldige geboortedatum voor een account: niet in de toekomst, niet ouder dan 120 jaar. */
export function isPlausibleDateOfBirth(d: Date, at: Date = new Date()): boolean {
  const age = ageOn(d, at);
  return age >= 0 && age <= 120 && d.getTime() <= at.getTime();
}

export function formatDateOfBirthInput(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}
