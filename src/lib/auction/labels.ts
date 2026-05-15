// Auction-label-systeem (Promotie-sectie). Sellers kiezen max 2 labels per
// veiling; bundle-tarief: 1 label €0,99 / 2 labels €1,69 (€0,29 korting op de 2e).
// Eigen kleurkeuze uit een gecureerd palet zit in de prijs inbegrepen.
//
// Bestand is bewust client-safe (geen Prisma-imports) zodat zowel form-componenten
// als render-componenten (auction-card, list-row) en de server-action het kunnen
// gebruiken zonder een serveronly-bestand te raken.

export const MAX_LABELS_PER_AUCTION = 2;

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
  "GEEN_RESERVE",
  "DIRECT_KOPEN",
  "MOET_NU_WEG",
  "HOT_ITEM",
  "TOPSTAAT",
  "ZELDZAAM",
  "HOLO_FOIL",
  "SNEL_VERZONDEN",
  "COMPLETE_SET",
] as const;
export type LabelType = (typeof LABEL_TYPES)[number];

// Bundle-tarief — bewust geen formule maar een lookup omdat de cap 2 is.
const LABEL_PRICING: Record<number, number> = { 0: 0, 1: 0.99, 2: 1.69 };

export function calculateLabelCost(count: number): number {
  const clamped = Math.max(0, Math.min(count, MAX_LABELS_PER_AUCTION));
  return LABEL_PRICING[clamped] ?? 0;
}

// CTR-uplift per upsell-categorie als best-case multiplier ("tot N× meer
// klikken"). Indicatief, hardcoded — we hebben nog geen eigen data. UI toont
// disclaimer "branchegemiddelden". Het effect is per categorie, niet per
// individueel label.
export const SPOTLIGHT_CTR_MULTIPLIER = 15;
export const CATEGORY_HIGHLIGHT_CTR_MULTIPLIER = 8;
export const LABELS_CTR_MULTIPLIER = 3;

export interface LabelAvailability {
  type: LabelType;
  available: boolean;
  reason?: string;
}

// Welke labels zijn beschikbaar gegeven de huidige form-state? Aangeroepen door
// zowel de UI (om te tonen wat klikbaar is) als de server (anti-tamper hercheck).
export function availableLabelsFor({
  reservePrice,
  buyNowPrice,
  condition,
  auctionType,
}: {
  reservePrice: number | null;
  buyNowPrice: number | null;
  condition: string | null;
  auctionType?: string | null;
}): LabelAvailability[] {
  const hasMintCondition = condition === "Mint" || condition === "Near Mint";
  const isCollection = auctionType === "COLLECTION";
  return [
    {
      type: "GEEN_RESERVE",
      available: !reservePrice || reservePrice === 0,
      reason: reservePrice ? "Alleen voor veilingen zonder reserve" : undefined,
    },
    {
      type: "DIRECT_KOPEN",
      available: !!buyNowPrice && buyNowPrice > 0,
      reason: !buyNowPrice ? "Alleen als Direct Kopen aan staat" : undefined,
    },
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

// Vaste kleurklassen-tabel — Tailwind kan dynamic class names niet purgen, dus
// we leveren ze hier als statische strings die de JIT-scanner oppikt.
// Gebruik: COLOR_CLASSES[label.colorKey] ?? COLOR_CLASSES.slate
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

// Hex-equivalents voor de color-picker swatch (visuele preview in popover).
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

export function isValidLabelType(value: string): value is LabelType {
  return (LABEL_TYPES as readonly string[]).includes(value);
}

export function isValidLabelColor(value: string): value is LabelColor {
  return (LABEL_COLORS as readonly string[]).includes(value);
}
