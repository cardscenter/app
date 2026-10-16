import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { PokemonHit } from "@/lib/global-search";

/** Pokédex-tegel voor de Pokémon-tab op /zoeken — kloon van de tegel op
 *  /pokedex, zonder type-badges (die vereisen extra PokéAPI-calls per rij). */
export function PokemonResultTile({ pokemon }: { pokemon: PokemonHit }) {
  return (
    <Link
      href={pokemon.href}
      className="group flex flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_2px_8px_0_var(--cc-border-subtle)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)] items-center p-3"
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
