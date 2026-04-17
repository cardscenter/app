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
