import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { PokemonHit } from "@/lib/global-search";

/** Pokédex-tegel voor de Pokémon-tab op /zoeken — kloon van de tegel op
 *  /pokedex, zonder type-badges (die vereisen extra PokéAPI-calls per rij). */
export function PokemonResultTile({ pokemon }: { pokemon: PokemonHit }) {
  return (
    <Link
      href={pokemon.href}
      className="group flex flex-col items-center rounded-xl border border-border bg-card p-3 transition-all hover:scale-[1.03] hover:shadow-md"
    >
      <div className="relative size-20 sm:size-24">
        <Image
          src={pokemon.spriteUrl}
          alt={pokemon.displayName}
          fill
          className="object-contain"
          sizes="96px"
          unoptimized
        />
      </div>
      <div className="mt-1 text-center">
        <div className="text-[10px] font-mono text-muted-foreground">
          #{String(pokemon.dexId).padStart(4, "0")}
        </div>
        <div className="truncate text-sm font-semibold text-foreground">
          {pokemon.displayName}
        </div>
      </div>
    </Link>
  );
}
