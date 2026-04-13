// Server-side fetch helpers for TCGdex (https://tcgdex.dev).
// All calls go through Next.js fetch + cache so we shield TCGdex from
// per-user request volume. Use only from API routes / server components —
// not from the client (browser CORS works, but caching wouldn't apply).

import type { TCGdexCardBrief, TCGdexCardFull, TCGdexSetBrief } from "./types";

const BASE = "https://api.tcgdex.net/v2";
const DEFAULT_LANG = "en";

// Cache TTLs in seconds. Search results are mostly stable but new sets release
// periodically; full-card data including pricing is the only thing that
// genuinely changes day-to-day.
const SEARCH_TTL = 60 * 60;       // 1h
const CARD_DETAIL_TTL = 60 * 60 * 24; // 24h
const SETS_TTL = 60 * 60 * 24;    // 24h

async function tcgdexFetch<T>(path: string, ttlSeconds: number): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    next: { revalidate: ttlSeconds },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`TCGdex ${res.status} on ${path}`);
  }

  return (await res.json()) as T;
}

/** Search cards by name. Returns brief records suitable for typeahead. */
export async function searchCards(
  query: string,
  opts: { limit?: number; lang?: string } = {}
): Promise<TCGdexCardBrief[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const lang = opts.lang ?? DEFAULT_LANG;
  const limit = opts.limit ?? 25;

  const results = await tcgdexFetch<TCGdexCardBrief[]>(
    `/${lang}/cards?name=${encodeURIComponent(trimmed)}`,
    SEARCH_TTL
  );

  return results.slice(0, limit);
}

/** Full card detail (incl. pricing) by stable TCGdex id. */
export async function getCard(
  id: string,
  opts: { lang?: string } = {}
): Promise<TCGdexCardFull | null> {
  const lang = opts.lang ?? DEFAULT_LANG;
  try {
    return await tcgdexFetch<TCGdexCardFull>(`/${lang}/cards/${id}`, CARD_DETAIL_TTL);
  } catch {
    return null;
  }
}

/** All Pokémon TCG sets (used in Fase 2 to seed CardSet table). */
export async function getSets(opts: { lang?: string } = {}): Promise<TCGdexSetBrief[]> {
  const lang = opts.lang ?? DEFAULT_LANG;
  return tcgdexFetch<TCGdexSetBrief[]>(`/${lang}/sets`, SETS_TTL);
}

/**
 * Build a card image URL. TCGdex's image field is a base URL like
 *   https://assets.tcgdex.net/en/base/base1/4
 * which becomes a real asset by appending /<quality>.<format>.
 */
export function buildCardImageUrl(
  base: string | undefined,
  quality: "low" | "high" = "low",
  format: "png" | "jpg" | "webp" = "webp"
): string | null {
  if (!base) return null;
  return `${base}/${quality}.${format}`;
}
