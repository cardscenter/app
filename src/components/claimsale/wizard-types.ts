import type { CardSearchSelectValue } from "@/components/ui/card-search-select";
import type { ClaimsaleUpsellType } from "@/lib/upsell-config";
import type { ClaimsaleLabelType, LabelColor } from "@/lib/claimsale/labels";

export type ClaimsaleType = "CARDS" | "ITEMS";

// Max lengte van de claimsale-beschrijving. Ruim genoeg voor een paar
// alinea's, maar bewust geen volledige A4.
export const CLAIMSALE_DESCRIPTION_MAX = 1000;

// Eén item-draft draagt zowel CARDS- als ITEMS-velden. Welke velden relevant
// zijn hangt af van ClaimsaleFormState.type — bij type-wissel wordt de items-
// array geleegd zodat er geen stale velden meereizen.
export interface ClaimsaleItemDraft {
  id: string;
  // Gedeeld
  price: string;
  sellerNote: string; // referentie-tekst, max 30 tekens
  // CARDS
  cardName: string;
  cardNumber: string;
  condition: string;
  variant: "normal" | "reverse";
  tcgdex: CardSearchSelectValue | null;
  frontImage: string | null;
  backImage: string | null;
  // ITEMS
  itemName: string;
  itemDescription: string;
  itemImages: string[];
}

// Flat-fee model: een upsell is een eenmalige aankoop voor de hele claimsale-
// looptijd (max 14 dagen). Geen dagen-keuze meer.
export interface ClaimsaleUpsellEntry {
  type: ClaimsaleUpsellType;
}

export interface ClaimsaleSelectedLabel {
  type: ClaimsaleLabelType;
  colorKey: LabelColor;
}

export interface ClaimsaleFormState {
  type: ClaimsaleType;
  coverImage: string | null;
  title: string;
  description: string;
  items: ClaimsaleItemDraft[];
  allowMailbox: boolean;
  startDate: Date;
  startTimeOfDay: string; // "HH:MM" NL-tijd
  upsells: ClaimsaleUpsellEntry[];
  labels: ClaimsaleSelectedLabel[];
}

export function makeEmptyCardItem(): ClaimsaleItemDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    price: "",
    sellerNote: "",
    cardName: "",
    cardNumber: "",
    condition: "Near Mint",
    variant: "normal",
    tcgdex: null,
    frontImage: null,
    backImage: null,
    itemName: "",
    itemDescription: "",
    itemImages: [],
  };
}

export function makeEmptyProductItem(): ClaimsaleItemDraft {
  return {
    ...makeEmptyCardItem(),
    condition: "Nieuw",
  };
}
