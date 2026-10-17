/**
 * Winkel-events (Community Hub, Fase 3) — puur bestand: statussen, regels en
 * helpers zonder Prisma/Next, zodat client-componenten en unit-tests ze
 * kunnen importeren. De DB-laag staat in `registrations.ts`.
 */
import { divisionFor, type AgeDivisionRule, POKEMON_DIVISIONS_2027 } from "@/lib/age";

/** Plek 10 minuten vastgezet zolang de speler betaalt. */
export const RESERVATION_MINUTES = 10;
/** Wachtlijst-aanbod: zo lang heeft de speler om te betalen/bevestigen. */
export const WAITLIST_OFFER_HOURS = 24;
/** Check-in mag vanaf zoveel uur vóór de start tot zoveel uur na het einde. */
export const CHECKIN_WINDOW_HOURS_BEFORE = 3;
export const CHECKIN_WINDOW_HOURS_AFTER = 3;
/** Pand-maximum als er geen instelling is opgeslagen. */
export const DEFAULT_MAX_OCCUPANCY = 60;

export const SHOP_EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"] as const;
export type ShopEventStatus = (typeof SHOP_EVENT_STATUSES)[number];

export const REGISTRATION_STATUSES = [
  "RESERVED",
  "CONFIRMED",
  "WAITLIST",
  "OFFERED",
  "CHECKED_IN",
  "NO_SHOW",
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** Statussen die een plek bezet houden (tellen mee voor de capaciteit). */
export const OCCUPYING_STATUSES: readonly RegistrationStatus[] = ["RESERVED", "CONFIRMED", "OFFERED", "CHECKED_IN"];
/** Statussen waarmee een speler "erbij" is (ticket geldig). */
export const ACTIVE_TICKET_STATUSES: readonly RegistrationStatus[] = ["CONFIRMED", "CHECKED_IN"];
/** Statussen waarin de rij "afgerond/dood" is en opnieuw boeken mag. */
export const TERMINAL_STATUSES: readonly RegistrationStatus[] = ["CANCELLED", "REFUNDED", "EXPIRED", "NO_SHOW"];

export const PAYMENT_STATUSES = ["OPEN", "PENDING", "PAID", "FAILED", "CANCELED", "EXPIRED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const EVENT_TYPE_COLORS = ["blue", "amber", "emerald", "violet", "rose", "slate"] as const;
export type EventTypeColor = (typeof EVENT_TYPE_COLORS)[number];

/** Tailwind-klassen per type-kleur (pill + kalender-stip). */
export const EVENT_COLOR_CLASSES: Record<EventTypeColor, { pill: string; dot: string }> = {
  blue: { pill: "border-blue-500/25 bg-blue-500/10 text-blue-700", dot: "bg-blue-500" },
  amber: { pill: "border-amber-500/25 bg-amber-500/10 text-amber-700", dot: "bg-amber-500" },
  emerald: { pill: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" },
  violet: { pill: "border-violet-500/25 bg-violet-500/10 text-violet-700", dot: "bg-violet-500" },
  rose: { pill: "border-rose-500/25 bg-rose-500/10 text-rose-700", dot: "bg-rose-500" },
  slate: { pill: "border-border bg-muted text-muted-foreground", dot: "bg-slate-500" },
};

export function eventColorClasses(color: string | null | undefined) {
  return EVENT_COLOR_CLASSES[(EVENT_TYPE_COLORS as readonly string[]).includes(color ?? "") ? (color as EventTypeColor) : "slate"];
}

/** Vooringevulde event-types (lazy geseed, net als GameOption). */
export const DEFAULT_EVENT_TYPES: Array<{
  key: string;
  name: string;
  game: string | null;
  description: string;
  color: EventTypeColor;
  ageDivisions: AgeDivisionRule[] | null;
  defaultPrice: number;
  defaultCapacity: number | null;
  countsForLeague: boolean;
  countsForStampCard: boolean;
  sortOrder: number;
}> = [
  {
    key: "league-avond",
    name: "League-avond",
    game: "pokemon",
    description: "Wekelijkse Pokémon League: gezellig spelen, ruilen en punten voor de league.",
    color: "blue",
    ageDivisions: POKEMON_DIVISIONS_2027,
    defaultPrice: 0,
    defaultCapacity: 28,
    countsForLeague: true,
    countsForStampCard: true,
    sortOrder: 10,
  },
  {
    key: "toernooi",
    name: "Toernooi",
    game: "pokemon",
    description: "Toernooi met inschrijving vooraf. Divisies op geboortejaar.",
    color: "amber",
    ageDivisions: POKEMON_DIVISIONS_2027,
    defaultPrice: 5,
    defaultCapacity: 28,
    countsForLeague: true,
    countsForStampCard: true,
    sortOrder: 20,
  },
  {
    key: "pre-release",
    name: "Pre-release",
    game: "pokemon",
    description: "Speel met een nieuwe set vóór de officiële release. Prijs is inclusief product.",
    color: "violet",
    ageDivisions: POKEMON_DIVISIONS_2027,
    defaultPrice: 30,
    defaultCapacity: 24,
    countsForLeague: false,
    countsForStampCard: true,
    sortOrder: 30,
  },
  {
    key: "vrij-spelen",
    name: "Vrij spelen en ruilen",
    game: null,
    description: "Inloop om te spelen en te ruilen, alle spellen welkom.",
    color: "emerald",
    ageDivisions: null,
    defaultPrice: 0,
    defaultCapacity: null,
    countsForLeague: false,
    countsForStampCard: true,
    sortOrder: 40,
  },
];

/** JSON (uit EventType.ageDivisions) → regels; ongeldig = []. */
export function parseAgeDivisions(raw: string | null | undefined): AgeDivisionRule[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is AgeDivisionRule => !!r && typeof r === "object" && typeof (r as AgeDivisionRule).key === "string" && typeof (r as AgeDivisionRule).label === "string")
      .map((r) => ({
        key: r.key.trim(),
        label: r.label.trim(),
        minBirthYear: Number.isInteger(r.minBirthYear) ? r.minBirthYear : undefined,
        maxBirthYear: Number.isInteger(r.maxBirthYear) ? r.maxBirthYear : undefined,
      }))
      .filter((r) => r.key && r.label);
  } catch {
    return [];
  }
}

/** Divisie-key voor een speler op dit event (null = geen divisies of geen match). */
export function divisionKeyFor(dateOfBirth: Date | null, rules: AgeDivisionRule[]): string | null {
  if (!dateOfBirth || rules.length === 0) return null;
  return divisionFor(dateOfBirth, rules)?.key ?? null;
}

export function divisionLabel(key: string | null | undefined, rules: AgeDivisionRule[]): string | null {
  if (!key) return null;
  return rules.find((r) => r.key === key)?.label ?? key;
}

/** Effectieve capaciteit: event-capaciteit én pand-maximum, laagste wint. */
export function effectiveCapacity(eventCapacity: number | null, maxOccupancy: number | null): number | null {
  const values = [eventCapacity, maxOccupancy].filter((v): v is number => typeof v === "number" && v > 0);
  if (values.length === 0) return null;
  return Math.min(...values);
}

export interface Availability {
  capacity: number | null;
  occupied: number;
  /** null = onbeperkt */
  spotsLeft: number | null;
  full: boolean;
  waitlistCount: number;
}

export function computeAvailability(args: {
  eventCapacity: number | null;
  maxOccupancy: number | null;
  occupied: number;
  waitlistCount: number;
}): Availability {
  const capacity = effectiveCapacity(args.eventCapacity, args.maxOccupancy);
  const spotsLeft = capacity === null ? null : Math.max(0, capacity - args.occupied);
  return {
    capacity,
    occupied: args.occupied,
    spotsLeft,
    full: spotsLeft !== null && spotsLeft <= 0,
    waitlistCount: args.waitlistCount,
  };
}

export type RegistrationWindow = "not-yet" | "open" | "closed" | "started" | "unavailable";

/** Is inschrijven nu mogelijk? Kijkt naar status en de inschrijf-vensters. */
export function registrationWindow(
  event: {
    status: string;
    startsAt: Date;
    registrationOpensAt: Date | null;
    registrationDeadline: Date | null;
  },
  now: Date = new Date(),
): RegistrationWindow {
  if (event.status !== "PUBLISHED") return "unavailable";
  if (now.getTime() >= event.startsAt.getTime()) return "started";
  if (event.registrationOpensAt && now.getTime() < event.registrationOpensAt.getTime()) return "not-yet";
  const deadline = event.registrationDeadline ?? event.startsAt;
  if (now.getTime() >= deadline.getTime()) return "closed";
  return "open";
}

/**
 * Mag de speler nog zelf annuleren mét terugbetaling? Tot `cancellationHours`
 * uur vóór de start. Daarna kan annuleren nog wel (plek vrijgeven), maar
 * zonder geld terug — dat beslist de admin handmatig.
 */
export function canCancelWithRefund(event: { startsAt: Date; cancellationHours: number }, now: Date = new Date()): boolean {
  const cutoff = event.startsAt.getTime() - event.cancellationHours * 3600_000;
  return now.getTime() < cutoff;
}

export function isWithinCheckInWindow(event: { startsAt: Date; endsAt: Date }, now: Date = new Date()): boolean {
  const from = event.startsAt.getTime() - CHECKIN_WINDOW_HOURS_BEFORE * 3600_000;
  const to = event.endsAt.getTime() + CHECKIN_WINDOW_HOURS_AFTER * 3600_000;
  return now.getTime() >= from && now.getTime() <= to;
}

/** Leeftijdscheck op de startdatum van het event. */
export function ageAllowed(age: number, event: { minAge: number | null; maxAge: number | null }): boolean {
  if (event.minAge !== null && age < event.minAge) return false;
  if (event.maxAge !== null && age > event.maxAge) return false;
  return true;
}

// Ticketcode: "CC-" + 6 tekens zonder verwarrende 0/O/1/I. 30^6 ≈ 729M
// combinaties; uniek via de @unique-index (retry bij botsing).
const TICKET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TICKET_CODE_REGEX = /^CC-[A-HJ-NP-Z2-9]{6}$/;

export function generateTicketCode(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(6);
  let out = "CC-";
  for (let i = 0; i < 6; i++) out += TICKET_ALPHABET[bytes[i] % TICKET_ALPHABET.length];
  return out;
}

function defaultRandom(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

/** Invoer uit een scanner/typveld normaliseren naar "CC-XXXXXX". */
export function normalizeTicketCode(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  // QR-payload "CC|CODE|SIG" → alleen de code
  const fromQr = s.startsWith("CC|") ? s.split("|")[1] : s;
  const withPrefix = fromQr.startsWith("CC-") ? fromQr : fromQr.length === 6 ? `CC-${fromQr}` : fromQr;
  return TICKET_CODE_REGEX.test(withPrefix) ? withPrefix : null;
}

/** Mollie wil bedragen als string met twee decimalen. */
export function toMollieAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

/** Mollie-status → onze Payment.status. */
export function mapProviderStatus(status: string): PaymentStatus {
  switch (status) {
    case "paid":
      return "PAID";
    case "pending":
    case "authorized":
      return "PENDING";
    case "failed":
      return "FAILED";
    case "canceled":
      return "CANCELED";
    case "expired":
      return "EXPIRED";
    default:
      return "OPEN";
  }
}

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  RESERVED: "Wacht op betaling",
  CONFIRMED: "Ingeschreven",
  WAITLIST: "Wachtlijst",
  OFFERED: "Plek aangeboden",
  CHECKED_IN: "Ingecheckt",
  NO_SHOW: "Niet verschenen",
  CANCELLED: "Geannuleerd",
  REFUNDED: "Terugbetaald",
  EXPIRED: "Verlopen",
};

export const SHOP_EVENT_STATUS_LABEL: Record<ShopEventStatus, string> = {
  DRAFT: "Concept",
  PUBLISHED: "Gepubliceerd",
  CANCELLED: "Geannuleerd",
  COMPLETED: "Afgerond",
};
