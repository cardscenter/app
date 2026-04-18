import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PokemonTypeBadge } from "./pokemon-type-badge";
import type { Pokemon, Species } from "@/lib/pokeapi/client";

interface Props {
  pokemon: Pokemon;
  species: Species;
  genus: string | null;        // pre-picked for the current locale
  flavorText: string | null;   // pre-picked for the current locale
}

// Height comes in decimetres, weight in hectograms. Convert for display.
function formatHeight(decimetres: number): string {
  return `${(decimetres / 10).toFixed(1)} m`;
}
function formatWeight(hectograms: number): string {
  return `${(hectograms / 10).toFixed(1)} kg`;
}

function titleCase(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export async function PokedexHero({ pokemon, species, genus, flavorText }: Props) {
  const t = await getTranslations("pokedex");
  const artwork =
    pokemon.sprites.other?.["official-artwork"]?.front_default ??
    pokemon.sprites.other?.home?.front_default ??
    pokemon.sprites.front_default;
  const displayName = titleCase(species.name);

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Artwork */}
        <div className="relative mx-auto aspect-square w-48 shrink-0 md:w-64">
          {artwork ? (
            <Image
              src={artwork}
              alt={displayName}
              fill
              className="object-contain"
              sizes="256px"
              priority
              unoptimized
            />
          ) : (
            <div className="flex size-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
              {t("noArtwork")}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex-1 space-y-3">
          <div className="text-sm font-mono text-muted-foreground">
            #{String(pokemon.id).padStart(4, "0")}
          </div>
          <h1 className="text-4xl font-bold text-foreground">{displayName}</h1>
          {genus && <p className="text-sm text-muted-foreground">{genus}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {pokemon.types
              .sort((a, b) => a.slot - b.slot)
              .map((t) => (
                <PokemonTypeBadge key={t.type.name} type={t.type.name} />
              ))}
            {species.is_legendary && (
              <span className="rounded-full bg-yellow-200 px-2.5 py-0.5 text-xs font-semibold text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200">
                {t("legendary")}
              </span>
            )}
            {species.is_mythical && (
              <span className="rounded-full bg-pink-200 px-2.5 py-0.5 text-xs font-semibold text-pink-900 dark:bg-pink-900/40 dark:text-pink-200">
                {t("mythical")}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{t("height")}:</strong> {formatHeight(pokemon.height)}
            </span>
            <span>
              <strong className="text-foreground">{t("weight")}:</strong> {formatWeight(pokemon.weight)}
            </span>
            {species.habitat && (
              <span>
                <strong className="text-foreground">{t("habitat")}:</strong>{" "}
                {titleCase(species.habitat.name)}
              </span>
            )}
          </div>

          {flavorText && (
            <p className="mt-2 text-sm italic text-foreground">&ldquo;{flavorText}&rdquo;</p>
          )}
        </div>
      </div>
    </section>
  );
}
