/**
 * Centrale username-policy (Fase 43).
 *
 * Eén bron van waarheid voor gebruikersnaam-regels: lengte/tekens, gereserveerde
 * namen (exact), rol-termen (substring — "Admin_2024" mag niet suggereren dat
 * iemand admin/moderator/eigenaar is) en een scheldwoorden-filter (NL + EN).
 *
 * Client-importable: géén "use server", géén prisma (patroon: address-cooldown.ts).
 * De case-insensitive DB-uniqueness-check leeft in username-policy-server.ts.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Exact verboden namen (lowercase-vergelijking): platform-routes en
 * systeemnamen die als displayName verwarring of phishing mogelijk maken.
 */
export const RESERVED_EXACT = new Set([
  // Bestaande reserved-set (Fase 37)
  "admin",
  "administrator",
  "cardscenter",
  "support",
  "help",
  "moderator",
  "system",
  "anonymous",
  "test",
  "null",
  "undefined",
  // Route-/systeemnamen (union met SHOP_SLUG_RESERVED)
  "login",
  "register",
  "dashboard",
  "api",
  "winkel",
  "verkoper",
  "marktplaats",
  "veilingen",
  "claimsales",
  "berichten",
  "winkelwagen",
  "zoeken",
  "saldo",
  "profiel",
  "abonnement",
  "settings",
  "contact",
  "about",
  "info",
  "noreply",
  "no-reply",
  "webmaster",
  "security",
]);

/**
 * Rol-termen: verboden als SUBSTRING van de genormaliseerde naam. Iemand die
 * "Support" of "Geverifieerd" in z'n naam draagt wekt vals vertrouwen.
 * Bewust NIET "mod" als losse term (te veel vals-positieven: modern, commodore).
 * Bekende geaccepteerde vals-positief: "badminton" bevat "admin" — zeldzame
 * botsing, veiligheid weegt zwaarder.
 */
export const ROLE_TERMS = [
  "admin",
  "beheerder",
  "moderat", // vangt moderator/moderatie
  "support",
  "staff",
  "medewerker",
  "helpdesk",
  "klantenservice",
  "cardscenter",
  "cardcenter",
  "official",
  "officieel",
  "geverifieerd",
  "verified",
  "eigenaar",
  "owner",
  "systeem",
  "system",
] as const;

/**
 * Scheldwoorden die als substring vrijwel nooit legitiem in een naam voorkomen
 * (lange termen, NL + EN). Korte woorden staan in PROFANITY_EXACT — als
 * substring zouden die te veel legitieme namen raken ("Pikachu" bevat "pik").
 */
export const PROFANITY_SUBSTRING = [
  // NL
  "kanker",
  "tering",
  "tyfus",
  "klootzak",
  "godverdomme",
  "neuk",
  "pedofiel",
  "pedo",
  "hoerenzoon",
  "mongool",
  "kutwijf",
  // EN / DE
  "fuck",
  "bitch",
  "cunt",
  "nigger",
  "nigga",
  "faggot",
  "whore",
  "slut",
  "rapist",
  "hitler",
  "nazi",
  "hurensohn",
] as const;

/**
 * Korte scheldwoorden: alleen verboden als de genormaliseerde naam er exact
 * aan gelijk is, of exact gelijk ná het strippen van cijfers ("kut123" → "kut").
 */
export const PROFANITY_EXACT = [
  "kut",
  "lul",
  "hoer",
  "slet",
  "pik",
  "kak",
  "shit",
  "piss",
  "anus",
] as const;

export type UsernamePolicyReason =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "INVALID_CHARS"
  | "RESERVED"
  | "NOT_ALLOWED";

export type UsernamePolicyResult =
  | { ok: true }
  | { ok: false; error: string; reason: UsernamePolicyReason };

/** Leet-speak-map zodat "4dm1n" en "adm1n" ook op "admin" matchen. */
const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
};

/**
 * Normaliseert een naam voor blocklist-matching: lowercase, scheidingstekens
 * (- en _) weg, leet-cijfers naar letters. "Ad-M1n_x" → "admin x"-achtig
 * ("adminx").
 */
export function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_]/g, "")
    .replace(/[01345]/g, (c) => LEET_MAP[c] ?? c);
}

const GENERIC_NOT_ALLOWED = "Deze gebruikersnaam is niet toegestaan";

/**
 * Valideert een gebruikersnaam tegen de volledige policy.
 * Volgorde: lengte → tekens → reserved (exact) → rol-termen (substring) →
 * scheldwoorden. De error voor rol/scheldwoord is bewust generiek — geen hint
 * welke term matchte (anti-omzeiling).
 */
export function validateUsername(name: string): UsernamePolicyResult {
  const trimmed = name.trim();

  if (trimmed.length < USERNAME_MIN) {
    return { ok: false, error: `Minimaal ${USERNAME_MIN} tekens`, reason: "TOO_SHORT" };
  }
  if (trimmed.length > USERNAME_MAX) {
    return { ok: false, error: `Maximaal ${USERNAME_MAX} tekens`, reason: "TOO_LONG" };
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      ok: false,
      error: "Alleen letters, cijfers, - en _",
      reason: "INVALID_CHARS",
    };
  }

  if (RESERVED_EXACT.has(trimmed.toLowerCase())) {
    return { ok: false, error: "Deze gebruikersnaam is gereserveerd", reason: "RESERVED" };
  }

  const termCheck = checkTerms(trimmed);
  if (!termCheck.ok) return termCheck;

  return { ok: true };
}

/**
 * Alleen de rol-term- en scheldwoord-checks (zonder lengte/regex/reserved) —
 * voor shop-slugs, die hun eigen formaat-regels + SHOP_SLUG_RESERVED hebben.
 */
export function validateSlugTerms(slug: string): UsernamePolicyResult {
  return checkTerms(slug);
}

function checkTerms(value: string): UsernamePolicyResult {
  const normalized = normalizeForMatch(value);

  for (const term of ROLE_TERMS) {
    if (normalized.includes(term)) {
      return { ok: false, error: GENERIC_NOT_ALLOWED, reason: "NOT_ALLOWED" };
    }
  }

  for (const term of PROFANITY_SUBSTRING) {
    if (normalized.includes(term)) {
      return { ok: false, error: GENERIC_NOT_ALLOWED, reason: "NOT_ALLOWED" };
    }
  }

  // Korte woorden: exact, of exact na cijfer-strip ("kut123" → "kut").
  // De cijfer-strip werkt op de variant ZONDER leet-map — anders wordt
  // "kut123" eerst "kutize" en matcht de strip niet meer.
  const bare = value.toLowerCase().replace(/[-_]/g, "");
  const bareNoDigits = bare.replace(/[0-9]/g, "");
  for (const term of PROFANITY_EXACT) {
    if (normalized === term || bare === term || bareNoDigits === term) {
      return { ok: false, error: GENERIC_NOT_ALLOWED, reason: "NOT_ALLOWED" };
    }
  }

  return { ok: true };
}
