import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Pagination } from "@/components/ui/pagination";
import { PokemonTypeBadge } from "@/components/pokedex/pokemon-type-badge";
import { listSpecies, listAllSpecies, dexIdFromUrl, getPokemon } from "@/lib/pokeapi/client";
import { pokedexSlug } from "@/lib/pokeapi/slug";

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
    description:
      "Blader door de Pokédex en ontdek elke Pokémon met stats, evoluties en alle kaarten die we in onze database hebben.",
  };
}

function spriteUrl(dexId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
}

function titleCase(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default async function PokedexIndexPage({ searchParams }: Props) {
  const { page: pageStr, q: qStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const rawQuery = (qStr ?? "").trim();
  const normalizedQuery = normalizeForSearch(rawQuery);

  const [locale, tBc] = await Promise.all([
    getLocale(),
    getTranslations("breadcrumbs"),
  ]);

  // When searching: fetch the full species list once (cached), filter by
  // name, then slice. Without a query, page the normal endpoint as before.
  // PokéAPI-species list includes entries beyond the main national dex
  // (alternate forms, fake test rows) — drop IDs ≥ 10_000 to avoid 404s.
  let baseItems: { name: string; dexId: number }[];
  let totalItems: number;

  if (normalizedQuery) {
    const all = await listAllSpecies();
    if (!all) {
      return (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">PokéAPI is momenteel niet bereikbaar.</p>
        </div>
      );
    }
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
  } else {
    const list = await listSpecies(offset, PAGE_SIZE);
    if (!list) {
      return (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">PokéAPI is momenteel niet bereikbaar.</p>
        </div>
      );
    }
    totalItems = list.count;
    baseItems = list.results
      .map((s) => {
        const dexId = dexIdFromUrl(s.url);
        return dexId && dexId < 10_000 ? { name: s.name, dexId } : null;
      })
      .filter((x): x is { name: string; dexId: number } => x !== null)
      .sort((a, b) => a.dexId - b.dexId);
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
    })
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: tBc("pokedex") }]} />

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Pokédex</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rawQuery
            ? `${totalItems.toLocaleString("nl-NL")} resultaat${totalItems === 1 ? "" : "en"} voor "${rawQuery}"`
            : `${totalItems.toLocaleString("nl-NL")} Pokémon — klik op een Pokémon voor stats, evoluties en alle kaarten in onze database.`}
        </p>
      </header>

      <form
        method="get"
        action={`/${locale}/pokedex`}
        className="mb-6 flex gap-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={rawQuery}
          placeholder="Zoek op naam (bv. Pikachu, Charizard)..."
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          Zoek
        </button>
        {rawQuery && (
          <Link
            href="/pokedex"
            className="flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Wissen
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Geen Pokémon gevonden voor &quot;{rawQuery}&quot;. Probeer een andere naam.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((p) => {
          const displayName = titleCase(p.name);
          return (
            <Link
              key={p.dexId}
              href={`/pokedex/${pokedexSlug(p.name, p.dexId)}`}
              className="group flex flex-col items-center rounded-xl border border-border bg-card p-3 transition-all hover:scale-[1.03] hover:shadow-md"
            >
              <div className="relative size-20 sm:size-24">
                <Image
                  src={spriteUrl(p.dexId)}
                  alt={displayName}
                  fill
                  className="object-contain"
                  sizes="96px"
                  unoptimized
                />
              </div>
              <div className="mt-1 text-center">
                <div className="text-[10px] font-mono text-muted-foreground">
                  #{String(p.dexId).padStart(4, "0")}
                </div>
                <div className="truncate text-sm font-semibold text-foreground">
                  {displayName}
                </div>
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

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        baseUrl="/pokedex"
        locale={locale}
        extraParams={rawQuery ? { q: rawQuery } : undefined}
      />
    </div>
  );
}
