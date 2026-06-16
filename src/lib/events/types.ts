// Gedeelde event-type-constants (client-safe, geen Prisma-import) zodat de
// wizard, filters, kaarten en server-actions dezelfde bron gebruiken.

export const EVENT_TYPES = [
  "BEURS",
  "TRADE_NIGHT",
  "OP_TOERNOOI",
  "RELEASE_EVENT",
  "MEETUP",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// De "Beurzen"-tab toont alleen beurzen; de "Events"-tab de rest.
export const BEURS_EVENT_TYPES: EventType[] = ["BEURS"];
export const OTHER_EVENT_TYPES: EventType[] = [
  "TRADE_NIGHT",
  "OP_TOERNOOI",
  "RELEASE_EVENT",
  "MEETUP",
];

export const EVENT_TYPE_LABELS_NL: Record<EventType, string> = {
  BEURS: "Beurs",
  TRADE_NIGHT: "Trade night",
  OP_TOERNOOI: "OP-toernooi",
  RELEASE_EVENT: "Release-event",
  MEETUP: "Meetup",
};

export const EVENT_TYPE_LABELS_EN: Record<EventType, string> = {
  BEURS: "Fair",
  TRADE_NIGHT: "Trade night",
  OP_TOERNOOI: "OP tournament",
  RELEASE_EVENT: "Release event",
  MEETUP: "Meetup",
};

export function getEventTypeLabel(type: string, locale: string): string {
  if (!isEventType(type)) return type;
  return locale === "en" ? EVENT_TYPE_LABELS_EN[type] : EVENT_TYPE_LABELS_NL[type];
}

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

// Per-type accentkleur voor pills (Tailwind statische strings).
export const EVENT_TYPE_PILL_CLASSES: Record<EventType, string> = {
  BEURS: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  TRADE_NIGHT: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  OP_TOERNOOI: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  RELEASE_EVENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  MEETUP: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

// Event-status (= publicatie-/approval-status).
export type EventStatus = "PENDING" | "LIVE" | "ENDED" | "REJECTED" | "DELETED";

export const ENTRY_CURRENCIES = ["EUR", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "CZK"] as const;
export type EntryCurrency = (typeof ENTRY_CURRENCIES)[number];
