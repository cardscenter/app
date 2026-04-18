// Extracts the base Pokémon name from a TCG card name so we can match
// siblings across all prints, forms, and themed variants.
//
// Examples:
//   "Charizard VMAX"      → "Charizard"
//   "Team Aqua's Kyogre"  → "Kyogre"
//   "Dark Gyarados"       → "Gyarados"
//   "Mega Rayquaza ex"    → "Rayquaza"
//   "Nidoran♀"            → "Nidoran"
//
// This mirrors the logic previously inlined in the card detail page, now
// lifted so the Pokédex page can reuse the same matching rules for its
// "Alle kaarten van deze Pokémon" section.

const SUFFIX_RE = /\b(mega|vmax|vstar|v-?union|gx|ex|v|break|lv\.?x|tag team|prime|legend)\b/gi;
const GENDER_RE = /[♀♂]/g;
const POSSESSIVE_PREFIX_RE = /^.+?'s\s+/i;        // "Team Aqua's ", "Lillie's "
const THEMATIC_PREFIX_RE = /^(dark|light|shining|radiant|shiny)\s+/i;

export function basePokemonName(
  cardName: string,
  category?: string | null
): string {
  let name = cardName.replace(SUFFIX_RE, "").replace(GENDER_RE, "");
  // Category defaults to Pokémon — older TCGdex data sometimes omits it but
  // the card is still a Pokémon. Only skip the prefix stripping for cards
  // we know aren't Pokémon (Trainers, Energies).
  const isPokemon = !category || category === "Pokemon";
  if (isPokemon) {
    name = name.replace(POSSESSIVE_PREFIX_RE, "").replace(THEMATIC_PREFIX_RE, "");
  }
  return name.replace(/\s+/g, " ").trim();
}
