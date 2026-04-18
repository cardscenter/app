// URL slug helpers for the Pokédex page — pattern: "pikachu-25".
// Analogous to src/lib/tcgdex/slug.ts, which keeps card URLs readable
// while remaining unique via the trailing numeric ID.

function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pokedexSlug(name: string, dexId: number): string {
  const nameSlug = slugifyName(name);
  return nameSlug ? `${nameSlug}-${dexId}` : String(dexId);
}

/** Parse "pikachu-25" → `{ name: "pikachu", dexId: 25 }`. Returns null if the
 * slug doesn't end with a numeric ID we can trust. */
export function parsePokedexSlug(slug: string): { name: string; dexId: number } | null {
  const m = slug.match(/^(.*?)-?(\d+)$/);
  if (!m) return null;
  const dexId = parseInt(m[2], 10);
  if (!Number.isFinite(dexId) || dexId < 1 || dexId > 10_000) return null;
  return { name: m[1] ?? "", dexId };
}
