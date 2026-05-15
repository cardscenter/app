// Listing-label-systeem (Promotie-sectie). Sellers kiezen max 2 labels per
// advertentie; bundle-tarief: 1 label €0,99 / 2 labels €1,69 (€0,29 korting op de 2e).
// Eigen kleurkeuze uit een gecureerd palet zit in de prijs inbegrepen.
//
// Bestand is bewust client-safe (geen Prisma-imports) zodat zowel form-componenten
// als render-componenten (listing-card, list-row) en de server-action het kunnen
// gebruiken zonder een serveronly-bestand te raken.
//
// Onderscheid t.o.v. auction-labels: GEEN_RESERVE en DIRECT_KOPEN zijn weggelaten —
// die zijn auction-jargon (listings hebben geen reserve, en zijn al direct-kopen
// by default). Kleurpalet + bundle-tarief is identiek voor visuele consistentie.

export const MAX_LABELS_PER_LISTING = 2;

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

export const LABEL_TYPES = [
  "MOET_NU_WEG",
  "HOT_ITEM",
  "TOPSTAAT",
  "ZELDZAAM",
  "HOLO_FOIL",
  "SNEL_VERZONDEN",
  "COMPLETE_SET",
] as const;
export type LabelType = (typeof LABEL_TYPES)[number];

const LABEL_PRICING: Record<number, number> = { 0: 0, 1: 0.99, 2: 1.69 };

export function calculateLabelCost(count: number): number {
  const clamped = Math.max(0, Math.min(count, MAX_LABELS_PER_LISTING));
  return LABEL_PRICING[clamped] ?? 0;
}

// CTR-uplift indicaties (best-case multiplier "tot N× meer klikken"). Aligned
// met auction-getallen voor consistente messaging op homepage/marktplaats.
export const SPOTLIGHT_CTR_MULTIPLIER = 15;
export const CATEGORY_HIGHLIGHT_CTR_MULTIPLIER = 8;
export const LABELS_CTR_MULTIPLIER = 3;

export interface LabelAvailability {
  type: LabelType;
  available: boolean;
  reason?: string;
}

export function availableLabelsFor({
  condition,
  listingType,
}: {
  condition: string | null;
  listingType?: string | null;
}): LabelAvailability[] {
  const hasMintCondition = condition === "Mint" || condition === "Near Mint";
  const isCollection = listingType === "COLLECTION";
  return [
    {
      type: "TOPSTAAT",
      available: hasMintCondition,
      reason:
        condition && !hasMintCondition
          ? "Alleen voor Mint of Near Mint"
          : undefined,
    },
    {
      type: "COMPLETE_SET",
      available: isCollection,
      reason: !isCollection ? "Alleen voor collecties" : undefined,
    },
    { type: "MOET_NU_WEG", available: true },
    { type: "HOT_ITEM", available: true },
    { type: "ZELDZAAM", available: true },
    { type: "HOLO_FOIL", available: true },
    { type: "SNEL_VERZONDEN", available: true },
  ];
}

// Tailwind purge-veilige class-mapping (geen dynamic class names).
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

export const LABEL_TEXT_NL: Record<LabelType, string> = {
  MOET_NU_WEG: "Moet nu weg",
  HOT_ITEM: "Hot item",
  TOPSTAAT: "Topstaat",
  ZELDZAAM: "Zeldzaam",
  HOLO_FOIL: "Holo / Foil",
  SNEL_VERZONDEN: "Snel verzonden",
  COMPLETE_SET: "Complete set",
};

export function isValidLabelType(value: string): value is LabelType {
  return (LABEL_TYPES as readonly string[]).includes(value);
}

export function isValidLabelColor(value: string): value is LabelColor {
  return (LABEL_COLORS as readonly string[]).includes(value);
}
