// PokeWallet API response types — based on api.pokewallet.io
// Verified 2026-04-19 against /search and /sets endpoints.

export interface PokewalletCardInfo {
  name: string;
  clean_name?: string;
  set_name?: string;
  set_code?: string | null;
  set_id?: string;
  card_number?: string | null;
  rarity?: string | null;
  card_type?: string | null;
  hp?: string | null;
  stage?: string | null;
  card_text?: string | null;
  attacks?: string[] | null;
  weakness?: string | null;
  resistance?: string | null;
  retreat_cost?: string | null;
}

export interface PokewalletCmPrice {
  variant_type: "normal" | "holo";
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
  updated_at?: string;
}

export interface PokewalletTpPrice {
  sub_type_name: "Normal" | "Holofoil" | "Reverse Holofoil" | string;
  low_price: number | null;
  mid_price: number | null;
  high_price: number | null;
  market_price: number | null;
  direct_low_price: number | null;
  updated_at?: string;
}

export interface PokewalletCard {
  id: string; // pk_xxx (TCG) or hex hash (CardMarket-only)
  card_info: PokewalletCardInfo;
  tcgplayer: {
    url?: string;
    prices: PokewalletTpPrice[];
  } | null;
  cardmarket: {
    product_name?: string;
    product_url?: string;
    prices: PokewalletCmPrice[];
  } | null;
}

export interface PokewalletPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PokewalletSearchResponse {
  query: string;
  results: PokewalletCard[];
  pagination: PokewalletPagination;
  metadata?: {
    total_count: number;
    tcg: number;
    cardmarket: number;
    tcg_only: number;
    cardmarket_only: number;
    both_sources: number;
  };
}

export interface PokewalletSetSummary {
  name: string;
  set_code: string | null;
  set_id: string;
  card_count: number;
  language: string | null;
  release_date: string | null;
}

export interface PokewalletSetsResponse {
  success: boolean;
  data: PokewalletSetSummary[];
  total: number;
}
