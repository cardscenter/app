// URL-slug helpers for the public card-database pages.

/**
 * Lowercase, ASCII-only, dash-separated slug suitable for URL segments.
 * Strips diacritics and special characters, collapses whitespace.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Build a card slug like "charizard-ex-054" — name-slug + localId so each card
 * has a unique URL even when names collide within a set.
 */
export function cardSlug(name: string, localId: string): string {
  return `${slugify(name)}-${localId.toLowerCase()}`;
}

/**
 * Extract the localId from a card slug. Returns null if no trailing
 * "-<localId>" segment is found.
 */
export function localIdFromSlug(slug: string): string | null {
  const idx = slug.lastIndexOf("-");
  if (idx < 0) return null;
  return slug.slice(idx + 1);
}
