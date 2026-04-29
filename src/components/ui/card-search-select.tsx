"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CardSearchSuggestion {
  id: string;            // TCGdex id, e.g. "base1-4"
  name: string;
  localId: string;       // card-number within set, e.g. "4"
  thumbnailUrl: string | null;
  setName?: string | null;
  setId?: string | null;
  releaseDate?: string | null;
  rarity?: string | null;
  variants?: string[];
}

export interface CardPricingSnapshot {
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg7: number | null;
  avg30: number | null;
  updated: string | null;
}

export interface CardSearchSelectValue extends CardSearchSuggestion {
  /** Full image URL (high quality) — only filled after detail fetch on select. */
  imageUrl?: string | null;
  /** CardMarket EUR pricing (normal print) — only filled after detail fetch. */
  pricing?: CardPricingSnapshot | null;
  /** CardMarket EUR pricing for reverse-holo variant — null if card has no reverse-holo. */
  pricingReverse?: CardPricingSnapshot | null;
  /** Series (Scarlet & Violet, Sword & Shield, …) — only after detail fetch. */
  series?: { id: string; name: string } | null;
}

interface Props {
  value: CardSearchSelectValue | null;
  onChange: (value: CardSearchSelectValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

const VARIANT_LABEL: Record<string, string> = {
  normal: "Normal",
  holo: "Holo",
  reverse: "Reverse",
  firstEdition: "1st Ed.",
  wPromo: "W Promo",
};

// The search endpoint stores the TCGdex `variants` field as the raw JSON
// string (e.g. `{"normal":true,"holo":false,...}`). We only care about the
// keys that are `true` — that's what the UI chip row shows.
function parseVariantKeys(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as Record<string, boolean>;
    return Object.entries(obj)
      .filter(([, v]) => v)
      .map(([k]) => k);
  } catch {
    return [];
  }
}

/**
 * Typeahead card picker — searches our local Card table via /api/cards/search.
 * On select, fetches /api/cards/{id} to add the high-res image and live
 * CardMarket pricing snapshot.
 */
export function CardSearchSelect({
  value,
  onChange,
  placeholder = "Zoek een kaart (bv. \"Charizard\" of \"Weedle Vivid Voltage\")…",
  disabled,
  className,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardSearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < MIN_QUERY) {
      setResults([]);
      setOpen(false);
      return;
    }

    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/cards/search?q=${encodeURIComponent(query.trim())}&limit=24`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          setError("Zoekopdracht mislukt.");
          setResults([]);
          setOpen(true);
          return;
        }
        const data: {
          totalCount: number;
          results: Array<{
            id: string;
            name: string;
            localId: string;
            rarity: string | null;
            setName: string | null;
            setSlug: string | null;
            releaseDate: string | null;
            imageUrl: string | null;
            variants: string | null;
          }>;
        } = await res.json();
        const mapped: CardSearchSuggestion[] = data.results.map((r) => ({
          id: r.id,
          name: r.name,
          localId: r.localId,
          thumbnailUrl: r.imageUrl,
          setName: r.setName,
          setId: r.setSlug,
          releaseDate: r.releaseDate,
          rarity: r.rarity,
          variants: parseVariantKeys(r.variants),
        }));
        setResults(mapped);
        setOpen(true);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError("Zoekopdracht mislukt.");
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function handleSelect(suggestion: CardSearchSuggestion) {
    setOpen(false);
    setQuery("");
    setResults([]);
    onChange(suggestion);

    try {
      const res = await fetch(`/api/cards/${encodeURIComponent(suggestion.id)}`);
      if (!res.ok) return;
      const detail = await res.json();
      onChange({
        ...suggestion,
        thumbnailUrl: detail.thumbnailUrl ?? suggestion.thumbnailUrl ?? null,
        imageUrl: detail.imageUrl ?? null,
        setName: detail.set?.name ?? suggestion.setName ?? null,
        setId: detail.set?.id ?? suggestion.setId ?? null,
        rarity: detail.rarity ?? suggestion.rarity ?? null,
        variants: Array.isArray(detail.variants) ? detail.variants : suggestion.variants,
        pricing: detail.pricing ?? null,
        pricingReverse: detail.pricingReverse ?? null,
        series: detail.series ?? null,
      });
    } catch {
      // Keep optimistic value if detail fetch fails — user already sees a result
    }
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  // Selected state
  if (value) {
    return (
      <div className={cn("flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-2.5", className)}>
        {value.thumbnailUrl ? (
          <Image
            src={value.thumbnailUrl}
            alt={value.name}
            width={60}
            height={84}
            className="rounded-md object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-[84px] w-[60px] items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
            Geen<br />afb.
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            #{value.localId}
            {value.setName && ` · ${value.setName}`}
          </p>
          {value.rarity && (
            <p className="mt-0.5 text-xs text-muted-foreground italic">{value.rarity}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="Wijzig kaart"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-9 text-sm outline-none ring-primary/40 focus:ring-2 disabled:opacity-50"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg sm:w-[min(640px,calc(100vw-2rem))]">
          {error && (
            <p className="p-3 text-sm text-red-500">{error}</p>
          )}
          {!error && results.length === 0 && !loading && query.trim().length >= MIN_QUERY && (
            <p className="p-3 text-sm text-muted-foreground">
              Geen kaarten gevonden voor &quot;{query}&quot;.
            </p>
          )}
          {!error && results.length > 0 && (
            // Mobile: vertical list. sm+: 2-col grid, lg+: 3-col grid.
            <div className="grid max-h-[70vh] grid-cols-1 gap-1 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="flex items-start gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted/60"
                >
                  {r.thumbnailUrl ? (
                    <Image
                      src={r.thumbnailUrl}
                      alt={r.name}
                      width={44}
                      height={62}
                      className="shrink-0 rounded object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-[62px] w-[44px] shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                      -
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {r.name}
                      <span className="ml-1 font-normal text-muted-foreground">#{r.localId}</span>
                    </p>
                    {r.setName && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {r.setName}
                        {r.releaseDate && ` · ${r.releaseDate.slice(0, 4)}`}
                      </p>
                    )}
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.rarity && (
                        <span className="rounded bg-muted/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          {r.rarity}
                        </span>
                      )}
                      {r.variants?.slice(0, 3).map((v) => (
                        <span key={v} className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
                          {VARIANT_LABEL[v] ?? v}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
