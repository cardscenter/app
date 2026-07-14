/**
 * Normalize a string for accent/diacritics-insensitive search.
 *
 * - Strips accents: é→e, ö→o, ü→u, etc.
 * - Removes hyphens, apostrophes, periods, colons
 * - Lowercases everything
 * - Collapses whitespace
 *
 * Examples:
 *   "Poké Pad"     → "poke pad"
 *   "Hakamo-o"     → "hakamoo"
 *   "Flabébé"      → "flabebe"
 *   "Farfetch'd"   → "farfetchd"
 *   "Nidoran♀"     → "nidoran♀"
 *   "M Rayquaza EX" → "m rayquaza ex"
 *   "Luxray GL LV.X" → "luxray gl lvx"
 */
export function normalizeForSearch(input: string): string {
  return input
    .normalize("NFD")                     // Decompose accents: é → e + ◌́
    .replace(/[\u0300-\u036f]/g, "")      // Strip combining diacritical marks
    .replace(/['\-.:]/g, "")              // Remove apostrophes, hyphens, dots, colons
    .toLowerCase()
    .replace(/\s+/g, " ")                 // Collapse whitespace
    .trim();
}

/**
 * Base where-clause for every Card text-search: TCG Pocket sets are a
 * separate mobile game and never for sale as physical cards.
 */
export const CARD_SEARCH_BASE_WHERE = {
  cardSet: { series: { tcgdexSeriesId: { notIn: ["tcgp"] } } },
} as const;

/**
 * Tokenized AND-clauses for a free-text card query. Every token must match
 * one of: normalized searchName, raw name, set name, or localId (numeric
 * tokens also match zero-padded variants: "4" → 04/004/0004).
 *
 * Shared by the /api/cards/search route and the global search.
 */
export function buildCardTokenClauses(q: string): Array<Record<string, unknown>> {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  const clauses: Array<Record<string, unknown>> = [];
  for (const original of tokens) {
    const nt = normalizeForSearch(original);
    const isNumeric = /^\d+$/.test(original);
    const ors: Array<Record<string, unknown>> = [
      { searchName: { contains: nt } },
      { name: { contains: original } },
      { cardSet: { name: { contains: original } } },
    ];
    if (isNumeric) {
      const n = parseInt(original, 10);
      const variants = Array.from(
        new Set([
          String(n),
          String(n).padStart(2, "0"),
          String(n).padStart(3, "0"),
          String(n).padStart(4, "0"),
        ])
      );
      ors.push({ localId: { in: variants } });
    } else {
      ors.push({ localId: { contains: original } });
    }
    clauses.push({ OR: ors });
  }
  return clauses;
}

/** Complete Card where-clause (base exclusions + tokenized text match). */
export function buildCardSearchWhere(q: string): Record<string, unknown> {
  const clauses = buildCardTokenClauses(q);
  return {
    ...CARD_SEARCH_BASE_WHERE,
    ...(clauses.length > 0 ? { AND: clauses } : {}),
  };
}
