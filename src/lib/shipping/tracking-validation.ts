// Per-carrier validatie van tracking-nummers (Fase 40).
//
// Voor de meeste carriers volgt een tracking-nummer een herkenbaar patroon
// (lengte, charset, prefix). Een nummer dat NIET aan dat patroon voldoet is
// hoogstwaarschijnlijk een typo of een verkeerd gekozen carrier. We blokkeren
// dan in markAsShipped met een user-friendly bericht "Trackingnummer lijkt
// niet te kloppen voor [carrier]" — sneller dan een dispute later achter het
// feit aan rennen omdat de buyer geen werkende tracking-link kreeg.
//
// Bewust permissief: carriers wijzigen soms hun nummer-format, internationale
// shipments hebben prefixed varianten, etc. Onze regexes vangen de meest
// voorkomende vormen + een lengte-range. "OTHER" valideert altijd OK want we
// kennen het format niet.

export interface TrackingValidationResult {
  ok: boolean;
  message?: string;
}

// Strip whitespace + uppercase voor consistente matching
function normalize(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

// Per-carrier regex. De `|` paden dekken meerdere geldige varianten.
//
// Sources:
//   - PostNL: 3S + 9-16 alphanumeriek (internationaal) of LA...NL (national)
//   - DHL: zeer divers; basis-check 10-40 alphanumeriek
//   - DPD: 14-cijferig (of 12-16 cijfers internationaal)
//   - GLS: 11-14 cijfers of 2-letter prefix + 9-12 cijfers
//   - UPS: 1Z + 16 alphanumeriek of 7-18 alphanumeriek (Mail Innovations)
//   - bpost: 18 cijfers (vaak 32xxxxxxx...)
//   - Deutsche Post: 12-22 cijfers
//   - La Poste: 11-13 alphanumeriek
const CARRIER_PATTERNS: Record<string, RegExp> = {
  POSTNL: /^(3S[A-Z0-9]{9,16}|LA\d{9,12}NL|RR\d{9}NL|CP\d{9}NL)$/,
  DHL: /^[A-Z0-9]{10,40}$/,
  DPD: /^\d{12,16}$/,
  GLS: /^(\d{11,14}|[A-Z]{2}\d{9,12})$/,
  UPS: /^(1Z[A-Z0-9]{16}|[A-Z0-9]{7,18})$/,
  BPOST: /^\d{16,20}$/,
  DEUTSCHE_POST: /^\d{12,22}$/,
  LA_POSTE: /^[A-Z0-9]{11,15}$/,
  // OTHER: geen patroon, altijd geldig (zie validateTrackingNumber)
};

// Algemene sanity-check: lengte 6-40, alleen alphanumeriek + streepjes
const GENERIC_PATTERN = /^[A-Z0-9-]{6,40}$/;

export function validateTrackingNumber(
  carrierId: string | null | undefined,
  rawNumber: string,
): TrackingValidationResult {
  const number = normalize(rawNumber);

  if (number.length === 0) {
    return { ok: false, message: "Voer een trackingnummer in" };
  }

  // Generic floor: minimaal 6 chars, alleen letters/cijfers/streepjes.
  // Voorkomt typo's als "abc" of "test".
  if (!GENERIC_PATTERN.test(number)) {
    return {
      ok: false,
      message: "Trackingnummer ziet er niet geldig uit (minstens 6 tekens, alleen letters/cijfers).",
    };
  }

  // Onbekende carrier of "OTHER" → alleen generic-check.
  if (!carrierId || !(carrierId in CARRIER_PATTERNS)) {
    return { ok: true };
  }

  const pattern = CARRIER_PATTERNS[carrierId];
  if (!pattern.test(number)) {
    return {
      ok: false,
      message: `Trackingnummer lijkt niet te kloppen voor de gekozen vervoerder. Controleer of je de juiste carrier hebt geselecteerd.`,
    };
  }

  return { ok: true };
}
