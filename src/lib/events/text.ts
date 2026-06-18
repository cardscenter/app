// Korte platte-tekst-snippet uit een (rich-text) HTML-beschrijving. Gebruikt
// voor de kaart-popups waar geen ruimte is voor opmaak.
export function plainTextSnippet(
  html: string | null | undefined,
  max = 40,
): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, " ") // tags weg
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ") // overige entities
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
