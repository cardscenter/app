// Type-definitions for the TCGdex public API (https://tcgdex.dev).
// Only the fields we currently use are typed — extend as needed.

export interface TCGdexCardBrief {
  id: string;          // e.g. "base1-4"
  localId: string;     // e.g. "4"
  name: string;
  image?: string;      // base URL — append "/<quality>.<format>" to get a real asset
}

export interface TCGdexSetBrief {
  id: string;          // e.g. "base1"
  name: string;        // e.g. "Base Set"
  cardCount: { official: number; total: number };
  logo?: string;
  symbol?: string;
}

export interface TCGdexPricingCardmarket {
  updated: string;
  unit: "EUR";
  idProduct: number;
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
  "avg-holo": number | null;
  "low-holo": number | null;
  "trend-holo": number | null;
  "avg1-holo": number | null;
  "avg7-holo": number | null;
  "avg30-holo": number | null;
}

export interface TCGdexPricing {
  cardmarket?: TCGdexPricingCardmarket | null;
  tcgplayer?: unknown | null;
}

export interface TCGdexAttack {
  cost?: string[];
  name: string;
  effect?: string;
  damage?: number | string;
}

export interface TCGdexAbility {
  type: string;
  name: string;
  effect: string;
}

export interface TCGdexWeakness {
  type: string;
  value: string;
}

export interface TCGdexCardFull extends TCGdexCardBrief {
  category: string;            // "Pokemon" | "Trainer" | "Energy"
  illustrator?: string;
  rarity?: string;
  set: {
    id: string;
    name: string;
    cardCount: { official: number; total: number };
    logo?: string;
    releaseDate?: string;
  };
  variants?: {
    firstEdition?: boolean;
    holo?: boolean;
    normal?: boolean;
    reverse?: boolean;
    wPromo?: boolean;
  };
  dexId?: number[];
  hp?: number;
  types?: string[];
  evolveFrom?: string;
  stage?: string;               // "Basic" | "Stage1" | "Stage2" | "Mega" | ...
  attacks?: TCGdexAttack[];
  abilities?: TCGdexAbility[];
  weaknesses?: TCGdexWeakness[];
  resistances?: TCGdexWeakness[];
  retreat?: number;
  regulationMark?: string;      // "A".."I"
  legal?: { standard?: boolean; expanded?: boolean };
  trainerType?: string;         // Item | Supporter | Stadium | ...
  energyType?: string;          // Basic | Special
  effect?: string;              // Trainer / Energy text
  pricing?: TCGdexPricing;
  updated?: string;
}
