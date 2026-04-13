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
}

export interface CardSearchSelectValue extends CardSearchSuggestion {
  /** Full image URL (high quality) — only filled after detail fetch on select. */
  imageUrl?: string | null;
  /** Set name from detail fetch. */
  setName?: string | null;
  /** Set id from detail fetch. */
  setId?: string | null;
  /** Card rarity from detail fetch. */
  rarity?: string | null;
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

/**
 * Typeahead card picker backed by the TCGdex proxy route.
 * On select, fetches full card detail to populate setName/imageUrl/rarity.
 */
export function CardSearchSelect({
  value,
  onChange,
  placeholder = "Zoek een kaart (bv. Charizard)…",
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
          `/api/tcgdex/search?q=${encodeURIComponent(query.trim())}&limit=20`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          if (res.status === 401) {
            setError("Je moet ingelogd zijn om kaarten te zoeken.");
          } else {
            setError("Zoekopdracht mislukt.");
          }
          setResults([]);
          setOpen(true);
          return;
        }
        const data: { results: CardSearchSuggestion[] } = await res.json();
        setResults(data.results);
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
    // Optimistic value with what we know — caller can render immediately
    onChange(suggestion);

    // Fetch detail for setName + high-res image + rarity
    try {
      const res = await fetch(`/api/tcgdex/card/${encodeURIComponent(suggestion.id)}`);
      if (!res.ok) return;
      const detail = await res.json();
      onChange({
        ...suggestion,
        imageUrl: detail.imageUrl ?? null,
        setName: detail.set?.name ?? null,
        setId: detail.set?.id ?? null,
        rarity: detail.rarity ?? null,
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

  // Selected state: show compact card preview with clear button
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
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
          {error && (
            <p className="p-3 text-sm text-red-500">{error}</p>
          )}
          {!error && results.length === 0 && !loading && query.trim().length >= MIN_QUERY && (
            <p className="p-3 text-sm text-muted-foreground">Geen kaarten gevonden voor &quot;{query}&quot;.</p>
          )}
          {!error && results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r)}
              className="flex w-full items-center gap-3 border-b border-border/40 p-2 text-left transition-colors last:border-b-0 hover:bg-muted/60"
            >
              {r.thumbnailUrl ? (
                <Image
                  src={r.thumbnailUrl}
                  alt={r.name}
                  width={36}
                  height={50}
                  className="rounded object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-[50px] w-[36px] shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                  -
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {r.id} · #{r.localId}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
