// PokeWallet HTTP client — wraps fetch with auth + simple rate-limit guard.
// Pro tier limit: 5000 calls/hour. Internal soft cap: 1000 calls/min.

import type {
  PokewalletCard,
  PokewalletSearchResponse,
  PokewalletSetsResponse,
} from "./types";

const BASE_URL = "https://api.pokewallet.io";

function getApiKey(): string {
  const key = process.env.POKEWALLET_API_KEY;
  if (!key) throw new Error("POKEWALLET_API_KEY not configured in environment");
  return key;
}

interface FetchOptions {
  retries?: number;
  retryDelayMs?: number;
}

async function pwFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelay = options.retryDelayMs ?? 1000;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "X-API-Key": getApiKey(),
        "Content-Type": "application/json",
      },
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const delayMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(baseDelay * 2 ** attempt, 60000);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw new Error(`PokeWallet rate-limited after ${retries} retries`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PokeWallet ${res.status} on ${path}: ${text.slice(0, 200)}`);
    }

    return res.json() as Promise<T>;
  }

  throw new Error("Unreachable");
}

export async function searchBySetId(
  setId: string,
  page: number = 1,
  limit: number = 100,
): Promise<PokewalletSearchResponse> {
  return pwFetch<PokewalletSearchResponse>(
    `/search?q=${encodeURIComponent(setId)}&limit=${limit}&page=${page}`,
  );
}

export async function searchByQuery(
  q: string,
  page: number = 1,
  limit: number = 100,
): Promise<PokewalletSearchResponse> {
  return pwFetch<PokewalletSearchResponse>(
    `/search?q=${encodeURIComponent(q)}&limit=${limit}&page=${page}`,
  );
}

export async function getCard(pokewalletId: string): Promise<{ id: string } & PokewalletCard> {
  return pwFetch(`/cards/${encodeURIComponent(pokewalletId)}`);
}

export async function listAllSets(): Promise<PokewalletSetsResponse> {
  return pwFetch<PokewalletSetsResponse>("/sets");
}

/** Fetch every page of a set in parallel via search endpoint (gives prices). */
export async function fetchAllPagesForSet(setId: string): Promise<PokewalletCard[]> {
  const first = await searchBySetId(setId, 1, 100);
  if (first.results.length === 0) return [];
  if (first.pagination.total_pages <= 1) return first.results;

  const remainingPages = Array.from(
    { length: first.pagination.total_pages - 1 },
    (_, i) => i + 2,
  );
  const rest = await Promise.all(remainingPages.map((p) => searchBySetId(setId, p, 100)));
  return [...first.results, ...rest.flatMap((r) => r.results)];
}

/**
 * Fallback for sets where /search returns 0 (typically brand-new sets that
 * haven't been indexed yet). Fetches card IDs from /sets, then per-card
 * pricing via /cards/:id. Costs N+1 calls for N cards.
 */
export async function fetchSetViaCardLookup(
  setIdOrCode: string,
): Promise<PokewalletCard[]> {
  const cards: PokewalletCard[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${BASE_URL}/sets/${encodeURIComponent(setIdOrCode)}?limit=200&page=${page}`,
      { headers: { "X-API-Key": getApiKey(), "Content-Type": "application/json" } },
    );
    if (!res.ok) throw new Error(`PokeWallet ${res.status} on /sets/${setIdOrCode}`);
    const data = (await res.json()) as {
      cards: { id: string; card_info: PokewalletCard["card_info"] }[];
      pagination: { page: number; total_pages: number };
    };
    if (!data.cards || data.cards.length === 0) break;

    // Fetch full pricing per card in parallel (max 5 at a time)
    for (let i = 0; i < data.cards.length; i += 5) {
      const batch = data.cards.slice(i, i + 5);
      const fetched = await Promise.all(batch.map((c) => getCard(c.id).catch(() => null)));
      for (const f of fetched) if (f) cards.push(f);
    }
    if (page >= data.pagination.total_pages) break;
    page++;
  }
  return cards;
}
