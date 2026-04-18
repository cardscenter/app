import type { FlavorTextEntry } from "./client";

// PokéAPI flavor text comes with `\f`, `\n`, and sometimes other control
// characters from the games' original line-break formatting. Strip them so
// the text renders cleanly in a paragraph.
function clean(text: string): string {
  return text.replace(/[\f\n\r]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Pick the best flavor text for the given locale, with fallback to English.
 *
 * PokéAPI returns many entries (one per game the species appears in). We
 * prefer the most recent English entry as a baseline — newer games use more
 * modern, readable text. If the site locale is "nl" and a Dutch entry
 * exists, prefer it; otherwise English.
 */
export function pickFlavorText(
  entries: FlavorTextEntry[],
  locale: "nl" | "en"
): string | null {
  if (!entries || entries.length === 0) return null;

  const preferredLang = locale === "nl" ? "nl" : "en";
  const preferred = entries.find((e) => e.language.name === preferredLang);
  if (preferred) return clean(preferred.flavor_text);

  // Fall back to English — try latest entries first (toward the end of the array)
  const englishEntries = entries.filter((e) => e.language.name === "en");
  if (englishEntries.length > 0) {
    const latest = englishEntries[englishEntries.length - 1];
    return clean(latest.flavor_text);
  }

  // Last resort: whatever the first entry is
  return clean(entries[0].flavor_text);
}
