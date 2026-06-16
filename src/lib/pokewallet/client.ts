// PokeWallet HTTP client — wraps fetch with auth + simple rate-limit guard.
// Pro tier limit: 5000 calls/hour. Internal soft cap: 1000 calls/min.

import type {
  PokewalletCard,
  PokewalletPriceHistoryResponse,
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
    // Hard 8s per-request timeout so a hanging PokeWallet can never stall the
    // caller indefinitely (matters for the nightly bulk-sync, which loops over
    // ~600 calls). A timeout aborts the fetch and surfaces as a thrown error,
    // handled like any other network failure by the cron's withRetry wrapper.
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "X-API-Key": getApiKey(),
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
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

/**
 * `GET /cards/:id/price-history` (Pro tier, v1.3.0+) — full TCGPlayer +
 * CardMarket history with pre-computed % change fields. Use sparingly:
 * 1 call per fetch. Recommended pattern: on-demand for the chart on a
 * single card-detail page view, NOT for bulk sync.
 *
 * Currently 7d / 14d windows are filled; 30d / 60d / 120d roll out as
 * PokeWallet accumulates more historical data.
 */
export async function getCardPriceHistory(
  pokewalletId: string,
): Promise<PokewalletPriceHistoryResponse> {
  return pwFetch<PokewalletPriceHistoryResponse>(
    `/cards/${encodeURIComponent(pokewalletId)}/price-history`,
  );
}

export async function listAllSets(): Promise<PokewalletSetsResponse> {
  return pwFetch<PokewalletSetsResponse>("/sets");
}

/**
 * Fetch every page of a set in parallel via search endpoint (gives prices).
 *
 * `/search?q=<setId>` is a fuzzy text query, not a strict set filter: for
 * low-numbered set_ids it also matches cards from OTHER sets whose
 * card_number contains the same digits (e.g. q=2328 returns "9/214" rows
 * from unrelated sets). We therefore drop any result whose card_info.set_id
 * differs from the requested id — keeping only the set we actually asked for.
 */
export async function fetchAllPagesForSet(setId: string): Promise<PokewalletCard[]> {
  const keepOwnSet = (cards: PokewalletCard[]): PokewalletCard[] =>
    cards.filter((c) => {
      const sid = c.card_info?.set_id;
      // Defensive: only drop when set_id is present AND clearly different.
      return sid == null || String(sid) === String(setId);
    });

  const first = await searchBySetId(setId, 1, 100);
  if (first.results.length === 0) return [];
  if (first.pagination.total_pages <= 1) return keepOwnSet(first.results);

  const remainingPages = Array.from(
    { length: first.pagination.total_pages - 1 },
    (_, i) => i + 2,
  );
  const rest = await Promise.all(remainingPages.map((p) => searchBySetId(setId, p, 100)));
  return keepOwnSet([...first.results, ...rest.flatMap((r) => r.results)]);
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
      {
        headers: { "X-API-Key": getApiKey(), "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) throw new Error(`PokeWallet ${res.status} on /sets/${setIdOrCode}`);
    const data = (await res.json()) as {
      cards: { id: string; card_info: PokewalletCard["card_info"] }[];
      pagination: { page: number; total_pages: number };
    };
    if (!data.cards || data.cards.length === 0) break;

    // Fetch full pricing per card in parallel (max 5 at a time). One retry per
    // card on transient failure (8s timeout): without it the occasional dropped
    // /cards lookup leaves a card permanently unpriced (e.g. SM secret rares).
    const fetchOne = (id: string) =>
      getCard(id).catch(() => getCard(id).catch(() => null));
    for (let i = 0; i < data.cards.length; i += 5) {
      const batch = data.cards.slice(i, i + 5);
      const fetched = await Promise.all(batch.map((c) => fetchOne(c.id)));
      for (const f of fetched) if (f) cards.push(f);
    }
    if (page >= data.pagination.total_pages) break;
    page++;
  }
  return cards;
}
