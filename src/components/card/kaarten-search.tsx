"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Search, Loader2, X, ChevronDown } from "lucide-react";
import { cardSlug } from "@/lib/tcgdex/slug";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  name: string;
  localId: string;
  rarity: string | null;
  setName: string;
  setSlug: string;
  releaseDate: string | null;
  imageUrl: string | null;
  priceAvg: number | null;
  priceReverseAvg: number | null;
  variants: string | null;
}

const FOIL_RE = /\b(holo|hyper|ultra|full art|illustration|special|double|amazing|radiant|shiny|secret|rainbow)\b/i;

function isFoilRarity(rarity: string | null): boolean {
  return FOIL_RE.test(rarity ?? "");
}

function effectivePrice(c: SearchResult): number | null {
  if (isFoilRarity(c.rarity) && c.priceReverseAvg !== null) return c.priceReverseAvg;
  return c.priceAvg;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

type Sort = "relevance" | "nameAsc" | "nameDesc" | "priceDesc" | "priceAsc" | "newest" | "oldest";

const SORT_LABELS: Record<Sort, string> = {
  relevance: "Relevantie",
  nameAsc: "Naam (A → Z)",
  nameDesc: "Naam (Z → A)",
  priceDesc: "Marktprijs (hoog → laag)",
  priceAsc: "Marktprijs (laag → hoog)",
  newest: "Nieuwste set eerst",
  oldest: "Oudste set eerst",
};

export function KaartenSearch({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= MIN_QUERY;

  useEffect(() => {
    if (trimmed.length < MIN_QUERY) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/cards/search?q=${encodeURIComponent(trimmed)}&limit=500`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json();
        setResults(data.results ?? []);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [trimmed]);

  return (
    <>
      <div className="mb-8">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Zoek op naam, set of nummer (bv. "Charizard", "Base Set", "4")'
            className="w-full rounded-xl border border-border bg-card py-3 pl-12 pr-20 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {loading && (
            <Loader2 className="pointer-events-none absolute right-11 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Wis zoekopdracht"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {hasQuery ? (
        <SearchResults results={results} loading={loading} query={trimmed} />
      ) : (
        children
      )}
    </>
  );
}

function SearchResults({
  results,
  loading,
  query,
}: {
  results: SearchResult[];
  loading: boolean;
  query: string;
}) {
  const [sort, setSort] = useState<Sort>("relevance");
  const [menuOpen, setMenuOpen] = useState(false);

  const sorted = useMemo(() => {
    if (sort === "relevance") return results;
    const arr = [...results];
    if (sort === "nameAsc") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "nameDesc") arr.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === "priceDesc" || sort === "priceAsc") {
      arr.sort((a, b) => {
        const pa = effectivePrice(a);
        const pb = effectivePrice(b);
        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;
        return sort === "priceDesc" ? pb - pa : pa - pb;
      });
    } else if (sort === "newest" || sort === "oldest") {
      arr.sort((a, b) => {
        const da = a.releaseDate ?? "";
        const db = b.releaseDate ?? "";
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return sort === "newest" ? db.localeCompare(da) : da.localeCompare(db);
      });
    }
    return arr;
  }, [results, sort]);

  if (loading && results.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Zoeken…</div>
    );
  }
  if (!loading && results.length === 0) {
    return (
      <div className="glass-subtle rounded-2xl p-12 text-center text-muted-foreground">
        Geen kaarten gevonden voor &quot;{query}&quot;.
      </div>
    );
  }
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {results.length} {results.length === 1 ? "kaart" : "kaarten"} gevonden
        </p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/40"
          >
            Sorteren: <span className="text-muted-foreground">{SORT_LABELS[sort]}</span>
            <ChevronDown className={cn("size-4 transition-transform", menuOpen && "rotate-180")} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              {(Object.keys(SORT_LABELS) as Sort[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSort(key); setMenuOpen(false); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                    sort === key && "bg-primary/10 font-semibold text-primary"
                  )}
                >
                  {SORT_LABELS[key]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {sorted.map((card) => {
          const price = effectivePrice(card);
          return (
            <Link
              key={card.id}
              href={`/kaarten/${card.setSlug}/${cardSlug(card.name, card.localId)}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:scale-[1.02] hover:shadow-lg"
            >
              <div className="relative aspect-[5/7] bg-muted">
                {card.imageUrl ? (
                  <Image
                    src={card.imageUrl}
                    alt={card.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs text-muted-foreground/50">
                    Geen afbeelding
                  </div>
                )}
              </div>
              <div className="space-y-1 p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{card.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    #{card.localId} · {card.setName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                  {price !== null && (
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      €{price.toFixed(2)}
                    </span>
                  )}
                  {card.priceReverseAvg !== null && !isFoilRarity(card.rarity) && (
                    <span className="inline-flex items-center gap-0.5 text-xs tabular-nums text-purple-600 dark:text-purple-400">
                      <span className="font-medium">Reverse</span> €{card.priceReverseAvg.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
