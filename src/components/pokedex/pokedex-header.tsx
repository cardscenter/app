import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PokemonTypeBadge } from "./pokemon-type-badge";
import type { Pokemon, Species } from "@/lib/pokeapi/client";

interface Props {
  pokemon: Pokemon;
  species: Species;
  genus: string | null; // pre-picked for the current locale
}

function titleCase(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Compacte header boven de tabs op de Pokédex-detailpagina: mini-artwork,
 * dex-nummer, naam, genus en type-badges. De uitgebreide info (groot artwork,
 * flavor text, feiten) leeft in de "Pokémon informatie"-tab (PokedexProfile).
 */
export async function PokedexHeader({ pokemon, species, genus }: Props) {
  const t = await getTranslations("pokedex");
  const artwork =
    pokemon.sprites.other?.["official-artwork"]?.front_default ??
    pokemon.sprites.other?.home?.front_default ??
    pokemon.sprites.front_default;
  const displayName = titleCase(species.name);

  return (
    <header className="mb-6 mt-2 flex items-center gap-4 sm:gap-5">
      <div className="relative size-20 shrink-0 rounded-2xl bg-muted/40 p-1.5 sm:size-24">
        {artwork && (
          <Image
            src={artwork}
            alt={displayName}
            fill
            className="object-contain p-1.5"
            sizes="96px"
            priority
            unoptimized
          />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-mono text-muted-foreground">
          #{String(pokemon.id).padStart(4, "0")}
        </div>
        <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">
          {displayName}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {pokemon.types
            .sort((a, b) => a.slot - b.slot)
            .map((ty) => (
              <PokemonTypeBadge key={ty.type.name} type={ty.type.name} size="sm" />
            ))}
          {species.is_legendary && (
            <span className="rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-semibold text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200">
              {t("legendary")}
            </span>
          )}
          {species.is_mythical && (
            <span className="rounded-full bg-pink-200 px-2 py-0.5 text-xs font-semibold text-pink-900 dark:bg-pink-900/40 dark:text-pink-200">
              {t("mythical")}
            </span>
          )}
          {genus && (
            <span className="text-xs text-muted-foreground">{genus}</span>
          )}
        </div>
      </div>
    </header>
  );
}
