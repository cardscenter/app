// Minimal TCGdex API client — used ONLY to build the card-list for a new set
// (names, numbers, rarities, images, gameplay metadata). Pricing is NEVER
// sourced here; that stays 100% PokeWallet (see src/lib/pokewallet/).
//
// TCGdex is free + keyless. We hit it sparingly: once per brand-new set during
// the catalog sync, then never again for that set (card-creation is idempotent).
// Card images keep coming from the TCGdex CDN regardless (static URLs in the DB).

const TCGDEX_BASE = "https://api.tcgdex.net/v2/en";
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 3;

export interface TcgdexCardBrief {
  id: string;        // e.g. "me04-001"
  localId: string;   // e.g. "001"
  name: string;
  image?: string;    // base URL, append /high.webp — may be absent pre-release
}

export interface TcgdexCardFull extends TcgdexCardBrief {
  rarity?: string;
  category?: string; // "Pokemon" | "Trainer" | "Energy"
  stage?: string;
  evolveFrom?: string;
  suffix?: string;
  hp?: number;
  types?: string[];
  illustrator?: string;
  dexId?: number[];
  regulationMark?: string;
  legal?: { standard?: boolean; expanded?: boolean };
  variants?: { firstEdition?: boolean; holo?: boolean; normal?: boolean; reverse?: boolean; wPromo?: boolean };
  attacks?: { cost?: string[]; name: string; effect?: string; damage?: number | string }[];
  abilities?: { type: string; name: string; effect: string }[];
  weaknesses?: { type: string; value: string }[];
  resistances?: { type: string; value: string }[];
  retreat?: number;
  trainerType?: string;
  energyType?: string;
  effect?: string;
}

export interface TcgdexSet {
  id: string;
  name: string;
  serie?: { id: string; name: string };
  logo?: string;
  symbol?: string;
  releaseDate?: string; // ISO "2026-05-22"
  cardCount?: { official?: number; total?: number; reverse?: number; holo?: number; normal?: number };
  cards?: TcgdexCardBrief[];
}

export interface TcgdexSetSummary {
  id: string;
  name: string;
  cardCount?: { official?: number; total?: number };
}

async function tcgdexFetch<T>(path: string): Promise<T | null> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${TCGDEX_BASE}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`TCGdex ${res.status} for ${path}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

/** Fetch a set with its card briefs. Returns null if the set doesn't exist. */
export function fetchTcgdexSet(setId: string): Promise<TcgdexSet | null> {
  return tcgdexFetch<TcgdexSet>(`/sets/${encodeURIComponent(setId)}`);
}

/** Fetch a single card's full detail. Returns null if not found. */
export function fetchTcgdexCard(cardId: string): Promise<TcgdexCardFull | null> {
  return tcgdexFetch<TcgdexCardFull>(`/cards/${encodeURIComponent(cardId)}`);
}

/** List all TCGdex sets (id + name) — used to resolve a set by name. */
export async function listTcgdexSets(): Promise<TcgdexSetSummary[]> {
  const data = await tcgdexFetch<TcgdexSetSummary[]>(`/sets`);
  return data ?? [];
}
