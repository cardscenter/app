import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PokemonTypeBadge } from "./pokemon-type-badge";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { Pill } from "@/components/ploy/pill";
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
 * Kop van de Pokédex-detailpagina (design-pass): artwork op een pastelblauw
 * vlak, dex-nummer als pil, naam in de display-letter, genus en type-badges.
 * De uitgebreide info leeft in de "Pokémon informatie"-tab (PokedexProfile).
 */
export async function PokedexHeader({ pokemon, species, genus }: Props) {
  const t = await getTranslations("pokedex");
  const artwork = pokemon.sprites.other?.["official-artwork"]?.front_default ?? pokemon.sprites.other?.home?.front_default ?? pokemon.sprites.front_default;
  const displayName = titleCase(species.name);

  return (
    <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
      <div className="relative size-32 shrink-0 overflow-hidden rounded-[20px] sm:size-40" style={{ background: "var(--pastel-blue)" }}>
        {artwork && <Image src={artwork} alt={displayName} fill className="object-contain p-3" sizes="160px" priority unoptimized />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="white">#{String(pokemon.id).padStart(4, "0")}</Pill>
          {genus && <Pill tone="pastel" color="blue">{genus}</Pill>}
          {species.is_legendary && <Pill color="yellow">{t("legendary")}</Pill>}
          {species.is_mythical && <Pill color="pink">{t("mythical")}</Pill>}
        </div>
        <DisplayHeading tag="h1" size={3} text={displayName} className="mt-3" />
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {pokemon.types
            .sort((a, b) => a.slot - b.slot)
            .map((ty) => (
              <PokemonTypeBadge key={ty.type.name} type={ty.type.name} size="md" />
            ))}
        </div>
      </div>
    </header>
  );
}
