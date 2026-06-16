// Event-label-systeem (Promotie-sectie van de aanmaak-wizard). Organisator
// kiest max 2 labels; bundle-tarief 1=€0,99 / 2=€1,69. Spiegelt
// src/lib/auction/labels.ts. Client-safe (geen Prisma).

export const MAX_LABELS_PER_EVENT = 2;

export const LABEL_COLORS = [
  "ruby",
  "amber",
  "emerald",
  "sky",
  "violet",
  "rose",
  "indigo",
  "slate",
  "orange",
  "teal",
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export const EVENT_LABEL_TYPES = [
  "GROTE_BEURS",
  "NIEUW",
  "GRATIS_ENTREE",
  "OFFICIEEL",
  "KINDVRIENDELIJK",
  "LAATSTE_PLEKKEN",
  "VEEL_RUILEN",
  "TOPLOCATIE",
] as const;
export type EventLabelType = (typeof EVENT_LABEL_TYPES)[number];

// Bundle-tarief — lookup omdat de cap 2 is.
const LABEL_PRICING: Record<number, number> = { 0: 0, 1: 0.99, 2: 1.69 };

export function calculateEventLabelCost(count: number): number {
  const clamped = Math.max(0, Math.min(count, MAX_LABELS_PER_EVENT));
  return LABEL_PRICING[clamped] ?? 0;
}

export const LABELS_CTR_MULTIPLIER = 3;

export interface EventLabelAvailability {
  type: EventLabelType;
  available: boolean;
  reason?: string;
}

// Welke labels mogen, gegeven de event-eigenschappen? Conditional labels
// voorkomen misleiding (bv. "Gratis entree" alleen bij FREE). Aangeroepen door
// de UI én de server (anti-tamper hercheck).
export function availableEventLabelsFor({
  entryType,
  isSanctioned,
  maxVisitors,
  canTrade,
}: {
  entryType?: string | null;
  isSanctioned?: boolean | null;
  maxVisitors?: number | null;
  canTrade?: boolean | null;
}): EventLabelAvailability[] {
  return [
    {
      type: "GRATIS_ENTREE",
      available: entryType === "FREE",
      reason: entryType !== "FREE" ? "Alleen bij gratis entree" : undefined,
    },
    {
      type: "OFFICIEEL",
      available: !!isSanctioned,
      reason: !isSanctioned ? "Alleen voor officieel gesanctioneerde events" : undefined,
    },
    {
      type: "LAATSTE_PLEKKEN",
      available: typeof maxVisitors === "number" && maxVisitors > 0,
      reason: !maxVisitors ? "Alleen als er een maximum aantal bezoekers is" : undefined,
    },
    {
      type: "VEEL_RUILEN",
      available: !!canTrade,
      reason: !canTrade ? "Alleen als ruilen mogelijk is" : undefined,
    },
    { type: "GROTE_BEURS", available: true },
    { type: "NIEUW", available: true },
    { type: "KINDVRIENDELIJK", available: true },
    { type: "TOPLOCATIE", available: true },
  ];
}

export const EVENT_LABEL_TEXT_NL: Record<EventLabelType, string> = {
  GROTE_BEURS: "Grote beurs",
  NIEUW: "Nieuw",
  GRATIS_ENTREE: "Gratis entree",
  OFFICIEEL: "Officieel",
  KINDVRIENDELIJK: "Kindvriendelijk",
  LAATSTE_PLEKKEN: "Laatste plekken",
  VEEL_RUILEN: "Veel ruilen",
  TOPLOCATIE: "Toplocatie",
};

// Vaste kleurklassen-tabel — Tailwind kan dynamic class names niet purgen.
export const COLOR_CLASSES: Record<LabelColor, string> = {
  ruby: "bg-rose-500 text-white",
  amber: "bg-amber-500 text-white",
  emerald: "bg-emerald-500 text-white",
  sky: "bg-sky-500 text-white",
  violet: "bg-violet-500 text-white",
  rose: "bg-pink-500 text-white",
  indigo: "bg-indigo-500 text-white",
  slate: "bg-slate-700 text-white",
  orange: "bg-orange-500 text-white",
  teal: "bg-teal-500 text-white",
};

export const COLOR_HEX: Record<LabelColor, string> = {
  ruby: "#f43f5e",
  amber: "#f59e0b",
  emerald: "#10b981",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  rose: "#ec4899",
  indigo: "#6366f1",
  slate: "#334155",
  orange: "#f97316",
  teal: "#14b8a6",
};

export function isValidEventLabelType(value: string): value is EventLabelType {
  return (EVENT_LABEL_TYPES as readonly string[]).includes(value);
}

export function isValidLabelColor(value: string): value is LabelColor {
  return (LABEL_COLORS as readonly string[]).includes(value);
}
