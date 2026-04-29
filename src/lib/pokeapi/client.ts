// Thin PokéAPI wrapper for the Pokédex page. Matches the pattern used in
// src/lib/tcgdex/sprite.ts — direct fetch + Next.js 7-day revalidate cache.
// Species data never changes upstream, so 7 days is safe.

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const POKEAPI_TTL = 60 * 60 * 24 * 7; // 7d

// ── Types — only the fields we actually render.

export interface PokemonTypeSlot {
  slot: number;
  type: { name: string; url: string };
}

export interface PokemonStat {
  base_stat: number;
  effort: number;
  stat: { name: string; url: string };
}

export interface PokemonAbility {
  is_hidden: boolean;
  slot: number;
  ability: { name: string; url: string };
}

export interface Pokemon {
  id: number;
  name: string;
  height: number;  // decimetres
  weight: number;  // hectograms
  types: PokemonTypeSlot[];
  stats: PokemonStat[];
  abilities: PokemonAbility[];
  sprites: {
    front_default: string | null;
    other?: {
      "official-artwork"?: { front_default: string | null };
      home?: { front_default: string | null };
    };
  };
}

export interface SpeciesName {
  name: string;
  language: { name: string; url: string };
}

export interface FlavorTextEntry {
  flavor_text: string;
  language: { name: string; url: string };
  version: { name: string; url: string };
}

export interface Genus {
  genus: string;
  language: { name: string; url: string };
}

export interface Species {
  id: number;
  name: string;
  names: SpeciesName[];
  genera: Genus[];
  flavor_text_entries: FlavorTextEntry[];
  evolution_chain: { url: string };
  varieties: { is_default: boolean; pokemon: { name: string; url: string } }[];
  habitat: { name: string; url: string } | null;
  is_legendary: boolean;
  is_mythical: boolean;
}

export interface EvolutionDetail {
  trigger: { name: string; url: string } | null;
  min_level: number | null;
  min_happiness: number | null;
  min_affection: number | null;
  min_beauty: number | null;
  item: { name: string; url: string } | null;
  held_item: { name: string; url: string } | null;
  known_move: { name: string; url: string } | null;
  known_move_type: { name: string; url: string } | null;
  location: { name: string; url: string } | null;
  time_of_day: string | null;
  needs_overworld_rain: boolean;
  gender: number | null;
}

export interface EvolutionChainNode {
  species: { name: string; url: string };
  evolution_details: EvolutionDetail[];
  evolves_to: EvolutionChainNode[];
}

export interface EvolutionChain {
  id: number;
  chain: EvolutionChainNode;
}

// ── Fetchers

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${POKEAPI_BASE}${path}`, {
      next: { revalidate: POKEAPI_TTL },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Full Pokémon data — stats, types, abilities, sprites, height/weight. */
export function getPokemon(dexId: number): Promise<Pokemon | null> {
  return get<Pokemon>(`/pokemon/${dexId}`);
}

/** Species data — flavor text, genera, evolution_chain URL, varieties. */
export function getSpecies(dexId: number): Promise<Species | null> {
  return get<Species>(`/pokemon-species/${dexId}`);
}

/** Evolution chain fetched by URL (URL comes from species.evolution_chain.url). */
export async function getEvolutionChain(url: string): Promise<EvolutionChain | null> {
  // URL is absolute — strip the base so we can reuse our `get()`.
  const path = url.replace(POKEAPI_BASE, "");
  return get<EvolutionChain>(path);
}

/** Extract the dex-ID from a species URL (".../pokemon-species/25/"). */
export function dexIdFromUrl(url: string): number | null {
  const m = url.match(/\/pokemon-species\/(\d+)\/?$/);
  return m ? parseInt(m[1], 10) : null;
}

// ── Index / list endpoint

export interface SpeciesListItem {
  name: string;
  url: string;
}

export interface SpeciesListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SpeciesListItem[];
}

/** Paginated Pokémon-species list, ordered by national dex ID ascending. */
export function listSpecies(offset: number, limit: number): Promise<SpeciesListResponse | null> {
  return get<SpeciesListResponse>(`/pokemon-species?offset=${offset}&limit=${limit}`);
}

/**
 * Full species list (all ~1300 entries). Used for name-search on the Pokédex
 * page — a single cached fetch is cheaper than paging the normal endpoint for
 * every query. Next.js caches this for 7 days (same TTL as paginated list).
 */
export function listAllSpecies(): Promise<SpeciesListResponse | null> {
  return get<SpeciesListResponse>(`/pokemon-species?limit=2000`);
}
