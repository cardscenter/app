// Claimsale-label-systeem (Promotie-sectie). Parallel aan src/lib/auction/labels.ts.
// Sellers kiezen max 2 labels per claimsale; bundle-tarief: 1 label €0,99 /
// 2 labels €1,69 (€0,29 korting op de 2e). Eigen kleurkeuze inbegrepen.
//
// Client-safe (geen Prisma-imports) — gebruikt door form-componenten,
// render-componenten (claimsale-card, list-row) en de server-action.
//
// Kleurenpalet wordt hergebruikt uit auction/labels.ts zodat de huisstijl
// één bron heeft. Label-TYPES verschillen wel: auction-only types
// (GEEN_RESERVE, DIRECT_KOPEN, COMPLETE_SET) hebben geen claimsale-equivalent.

import {
  LABEL_COLORS,
  COLOR_CLASSES,
  COLOR_HEX,
  isValidLabelColor,
  type LabelColor,
} from "@/lib/auction/labels";

export { LABEL_COLORS, COLOR_CLASSES, COLOR_HEX, isValidLabelColor };
export type { LabelColor };

export const MAX_LABELS_PER_CLAIMSALE = 2;

export const CLAIMSALE_LABEL_TYPES = [
  "MOET_NU_WEG",
  "HOT_ITEM",
  "TOPSTAAT",
  "ZELDZAAM",
  "HOLO_FOIL",
  "SNEL_VERZONDEN",
  "NIEUW",
  "OPRUIMING",
] as const;
export type ClaimsaleLabelType = (typeof CLAIMSALE_LABEL_TYPES)[number];

// Bundle-tarief — lookup ipv formule omdat de cap 2 is.
const LABEL_PRICING: Record<number, number> = { 0: 0, 1: 0.99, 2: 1.69 };

export function calculateClaimsaleLabelCost(count: number): number {
  const clamped = Math.max(0, Math.min(count, MAX_LABELS_PER_CLAIMSALE));
  return LABEL_PRICING[clamped] ?? 0;
}

export const CLAIMSALE_LABELS_CTR_MULTIPLIER = 3;

export interface ClaimsaleLabelAvailability {
  type: ClaimsaleLabelType;
  available: boolean;
  reason?: string;
}

// Welke labels zijn beschikbaar gegeven het claimsale-type + of er een
// Mint/Near Mint-item in zit. Aangeroepen door de UI (klikbaarheid) en de
// server (anti-tamper hercheck).
export function availableClaimsaleLabelsFor({
  claimsaleType,
  hasMintItem,
}: {
  claimsaleType: string;
  hasMintItem: boolean;
}): ClaimsaleLabelAvailability[] {
  const isCards = claimsaleType === "CARDS";
  const isItems = claimsaleType === "ITEMS";
  return [
    {
      type: "TOPSTAAT",
      available: isCards && hasMintItem,
      reason: !isCards
        ? "Alleen voor kaarten-claimsales"
        : !hasMintItem
          ? "Voeg een Near Mint-kaart toe"
          : undefined,
    },
    {
      type: "HOLO_FOIL",
      available: isCards,
      reason: !isCards ? "Alleen voor kaarten-claimsales" : undefined,
    },
    {
      type: "NIEUW",
      available: isItems,
      reason: !isItems ? "Alleen voor items-claimsales" : undefined,
    },
    { type: "MOET_NU_WEG", available: true },
    { type: "HOT_ITEM", available: true },
    { type: "ZELDZAAM", available: true },
    { type: "SNEL_VERZONDEN", available: true },
    { type: "OPRUIMING", available: true },
  ];
}

export function isValidClaimsaleLabelType(value: string): value is ClaimsaleLabelType {
  return (CLAIMSALE_LABEL_TYPES as readonly string[]).includes(value);
}
