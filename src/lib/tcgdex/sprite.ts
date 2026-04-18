// Resolve the PokéAPI Showdown sprite URL for a card.
// TCGdex's dexId is sometimes wrong (e.g. Mega Absol ex tagged dexId 351 /
// Castform), so we look up the species by cleaned card name and only fall
// back to dexId when that fails. Mega / VMAX / G-Max forms resolve their
// specific variety id via /pokemon-species/{id}/varieties.

const POKEAPI_TTL = 60 * 60 * 24 * 7; // 7d — species data never changes

function cleanSpeciesSlug(rawName: string): string {
  return rawName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(mega|vmax|vstar|v-?union|gx|ex|v|break|lv\.?x|tag team|prime|legend)\b/gi, "")
    .replace(/[♀♂]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[.']/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detectFormSuffix(rawName: string, stage?: string | null): string | null {
  const lower = rawName.toLowerCase();
  const s = (stage ?? "").toLowerCase();
  if (/\bmega\b/.test(lower) || s === "mega") return "mega";
  if (/\bvmax\b/.test(lower) || s === "vmax") return "gmax";
  if (/\bgigantamax\b|\bg-?max\b/.test(lower)) return "gmax";
  return null;
}

async function resolveViaSpecies(
  speciesRef: string | number,
  targetSuffix: string | null
): Promise<number | null> {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesRef}`, {
      next: { revalidate: POKEAPI_TTL },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      id: number;
      varieties?: { pokemon: { name: string; url: string } }[];
    };
    if (!targetSuffix) return data.id;
    const match = data.varieties?.find((v) => v.pokemon.name.endsWith(`-${targetSuffix}`));
    if (!match) return data.id;
    const varietyId = match.pokemon.url.match(/\/pokemon\/(\d+)\/?$/)?.[1];
    return varietyId ? parseInt(varietyId, 10) : data.id;
  } catch { return null; }
}

/** Resolve a Pokémon's Showdown sprite URL, or null if not resolvable. */
export async function resolveSpriteUrl(args: {
  cardName: string;
  stage?: string | null;
  dexIdFallback?: number | null;
  category?: string | null;
}): Promise<string | null> {
  // Only Pokémon cards have sprites
  if (args.category && args.category !== "Pokemon") return null;

  const targetSuffix = detectFormSuffix(args.cardName, args.stage);
  const slug = cleanSpeciesSlug(args.cardName);

  let id: number | null = slug ? await resolveViaSpecies(slug, targetSuffix) : null;
  if (!id && args.dexIdFallback) {
    id = await resolveViaSpecies(args.dexIdFallback, targetSuffix);
  }
  if (!id) return null;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;
}
