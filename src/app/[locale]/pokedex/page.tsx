import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { Search, X } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { PokemonTypeBadge } from "@/components/pokedex/pokemon-type-badge";
import { listSpecies, listAllSpecies, dexIdFromUrl, getPokemon } from "@/lib/pokeapi/client";
import { pokedexSlug } from "@/lib/pokeapi/slug";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { CenteredHero } from "@/components/ploy/centered-hero";
import { PunchCard } from "@/components/ploy/punch-card";
import { TILE, SEARCH_INPUT, PILL_RED, PILL_BTN } from "@/components/ploy/tile-styles";

export const revalidate = 604800; // 7d — the species list is essentially static

const PAGE_SIZE = 48;

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>;
}

// Normalize for name search: strip whitespace, hyphens, dots so "Mr. Mime",
// "mr-mime" and "mrmime" all match.
function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/[\s\-.]+/g, "");
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Pokédex — Cards Center",
    description: "Blader door de Pokédex en ontdek elke Pokémon met stats, evoluties en alle kaarten die we in onze database hebben.",
  };
}

function spriteUrl(dexId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
}

function titleCase(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Pokédex-overzicht (design-pass Fase E): hero met zoekveld, tegels met sprite, nummer, naam en types. */
export default async function PokedexIndexPage({ searchParams }: Props) {
  const { page: pageStr, q: qStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const rawQuery = (qStr ?? "").trim();
  const normalizedQuery = normalizeForSearch(rawQuery);
  const locale = await getLocale();

  // When searching: fetch the full species list once (cached), filter by
  // name, then slice. Without a query, page the normal endpoint as before.
  // PokéAPI-species list includes entries beyond the main national dex
  // (alternate forms, fake test rows) — drop IDs ≥ 10_000 to avoid 404s.
  let baseItems: { name: string; dexId: number }[];
  let totalItems: number;
  let unavailable = false;

  if (normalizedQuery) {
    const all = await listAllSpecies();
    if (!all) {
      unavailable = true;
      baseItems = [];
      totalItems = 0;
    } else {
      const filtered = all.results
        .map((s) => {
          const dexId = dexIdFromUrl(s.url);
          return dexId && dexId < 10_000 ? { name: s.name, dexId } : null;
        })
        .filter((x): x is { name: string; dexId: number } => x !== null)
        .filter((p) => normalizeForSearch(p.name).includes(normalizedQuery))
        .sort((a, b) => a.dexId - b.dexId);
      totalItems = filtered.length;
      baseItems = filtered.slice(offset, offset + PAGE_SIZE);
    }
  } else {
    const list = await listSpecies(offset, PAGE_SIZE);
    if (!list) {
      unavailable = true;
      baseItems = [];
      totalItems = 0;
    } else {
      totalItems = list.count;
      baseItems = list.results
        .map((s) => {
          const dexId = dexIdFromUrl(s.url);
          return dexId && dexId < 10_000 ? { name: s.name, dexId } : null;
        })
        .filter((x): x is { name: string; dexId: number } => x !== null)
        .sort((a, b) => a.dexId - b.dexId);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  // Fetch types per Pokémon so we can render colored type badges on each
  // tile. Parallel fetches; each URL is cached 7 days so repeat page loads
  // are instant. The fetch layer returns null on error, in which case we
  // simply omit the types.
  const items = await Promise.all(
    baseItems.map(async (p) => {
      const detail = await getPokemon(p.dexId);
      const types = detail?.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name) ?? [];
      return { ...p, types };
    }),
  );

  const description = unavailable
    ? "PokéAPI is momenteel niet bereikbaar. Probeer het later opnieuw."
    : rawQuery
      ? `${totalItems.toLocaleString("nl-NL")} resultaat${totalItems === 1 ? "" : "en"} voor "${rawQuery}".`
      : `${totalItems.toLocaleString("nl-NL")} Pokémon. Klik op een Pokémon voor stats, evoluties en alle kaarten in onze database.`;

  return (
    <div className="cc-landing overflow-clip">
      <ScrollToTop />
      <CenteredHero eyebrow="Pokédex" eyebrowColor="blue" title="Elke Pokémon, elke kaart" highlightWord="Pokémon" highlightColor="blue" description={description} className="pb-6 lg:pb-8">
        <form method="get" action={`/${locale}/pokedex`} className="flex w-full max-w-xl items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--foreground)]/45" />
            <input type="search" name="q" defaultValue={rawQuery} placeholder="Zoek op naam (bv. Pikachu, Charizard)" className={`${SEARCH_INPUT} pl-12 pr-4`} />
          </div>
          <button type="submit" className={`${PILL_RED} py-3.5`}>
            Zoek
          </button>
          {rawQuery && (
            <Link href="/pokedex" className={`${PILL_BTN} py-3.5`} aria-label="Wissen">
              <X className="size-4" />
            </Link>
          )}
        </form>
      </CenteredHero>

      <section className="flex justify-center px-4 pb-16 sm:px-5 lg:px-6 lg:pb-24">
        <div className="w-full max-w-6xl">
          {items.length === 0 ? (
            <PunchCard className="bg-white p-12 text-center text-[var(--foreground)]/60" dot="var(--border)">
              {unavailable ? "PokéAPI is momenteel niet bereikbaar." : `Geen Pokémon gevonden voor "${rawQuery}". Probeer een andere naam.`}
            </PunchCard>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {items.map((p) => {
                const displayName = titleCase(p.name);
                return (
                  <Link key={p.dexId} href={`/pokedex/${pokedexSlug(p.name, p.dexId)}`} className={`${TILE} items-center p-3 no-underline`}>
                    <div className="relative size-20 sm:size-24">
                      <Image src={spriteUrl(p.dexId)} alt={displayName} fill className="object-contain" sizes="96px" unoptimized />
                    </div>
                    <div className="mt-1 text-center">
                      <div className="font-mono text-[10px] text-[var(--foreground)]/50">#{String(p.dexId).padStart(4, "0")}</div>
                      <div className="truncate text-sm font-semibold text-[var(--foreground)]">{displayName}</div>
                    </div>
                    {p.types.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                        {p.types.map((t) => (
                          <PokemonTypeBadge key={t} type={t} size="sm" />
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          <Pagination currentPage={page} totalPages={totalPages} baseUrl="/pokedex" locale={locale} extraParams={rawQuery ? { q: rawQuery } : undefined} />
        </div>
      </section>
    </div>
  );
}
