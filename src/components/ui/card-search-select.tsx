"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
// Fetch wat extra zodat "Meer weergeven" puur client-side kan zonder re-fetch.
// Eerste view toont alleen de top-INITIAL_VISIBLE — klik onthult de rest.
const FETCH_LIMIT = 60;
const INITIAL_VISIBLE = 24;

const VARIANT_LABEL: Record<string, string> = {
  holo: "Holo",
  reverse: "Reverse",
  firstEdition: "1st Ed.",
  wPromo: "W Promo",
};

// "normal" verbergen we — alle kaarten hebben een normal-print, dus die
// variant-chip zegt niets en vervuilt de resultaat-rij. Alleen bijzondere
// printtypes (Holo / Reverse / 1st Ed. / W Promo) zijn relevant.
const HIDDEN_VARIANTS = new Set(["normal"]);

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
  const [expanded, setExpanded] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Bereken dropdown-positie t.o.v. viewport zodra 'ie opent. Update bij scroll
  // en resize zodat de dropdown blijft "kleven" aan de input ook als de
  // achtergrond beweegt. Via Portal + position:fixed ontsnappen we elke
  // parent stacking-context — voorkomt de iOS Safari z-index-trap die
  // sticky + backdrop-filter veroorzaakt.
  useEffect(() => {
    if (!open) {
      setDropdownRect(null);
      return;
    }
    function updatePosition() {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

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
      // Reset expand-state — nieuwe zoekopdracht start altijd in compact-mode.
      setExpanded(false);
      try {
        const res = await fetch(
          `/api/cards/search?q=${encodeURIComponent(query.trim())}&limit=${FETCH_LIMIT}`,
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

  // Close on outside click — dropdown zit nu via Portal in document.body dus
  // buiten de wrapper-DOM-tree. Beide refs checken zodat clicks op dropdown
  // niet als "outside" tellen.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
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

  // Selected state — grotere preview + uitgebreide info-rij
  if (value) {
    const previewSrc = value.imageUrl ?? value.thumbnailUrl;
    const filteredVariants = value.variants?.filter((v) => !HIDDEN_VARIANTS.has(v)) ?? [];
    const releaseYear = value.releaseDate?.slice(0, 4);
    return (
      <div className={cn("relative flex items-start gap-4 rounded-xl border border-border bg-muted/30 p-3 sm:p-4", className)}>
        {previewSrc ? (
          <Image
            src={previewSrc}
            alt={value.name}
            width={140}
            height={196}
            className="shrink-0 rounded-lg object-cover ring-1 ring-black/5 dark:ring-white/10"
            unoptimized
          />
        ) : (
          <div className="flex h-[196px] w-[140px] shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
            Geen<br />afbeelding
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2 pr-8">
          <div>
            <p className="text-base font-semibold leading-snug text-foreground sm:text-lg">
              {value.name}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">#{value.localId}</span>
            </p>
            {value.setName && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {value.setName}
                {releaseYear && <span className="ml-1 text-muted-foreground/70">· {releaseYear}</span>}
              </p>
            )}
            {value.series?.name && (
              <p className="mt-0.5 text-xs text-muted-foreground/80">{value.series.name}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {value.rarity && (
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground ring-1 ring-border">
                {value.rarity}
              </span>
            )}
            {filteredVariants.map((v) => (
              <span
                key={v}
                className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-primary/20"
              >
                {VARIANT_LABEL[v] ?? v}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
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
          className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-9 text-base outline-none ring-primary/40 focus:ring-2 disabled:opacity-50 sm:text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && dropdownRect && typeof document !== "undefined" && createPortal(
        // Dropdown via Portal in document.body — ontsnapt alle parent
        // stacking-contexts (sticky form-progress, backdrop-filter, etc.).
        // Position fixed met dynamische top/left/width o.b.v. de input-
        // bounding-rect. Update via scroll/resize-listeners.
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            zIndex: 100,
          }}
          className="overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
        >
          {error && (
            <p className="p-3 text-sm text-red-500">{error}</p>
          )}
          {!error && results.length === 0 && !loading && query.trim().length >= MIN_QUERY && (
            <p className="p-3 text-sm text-muted-foreground">
              Geen kaarten gevonden voor &quot;{query}&quot;.
            </p>
          )}
          {!error && results.length > 0 && (() => {
            const visible = expanded ? results : results.slice(0, INITIAL_VISIBLE);
            const hiddenCount = results.length - INITIAL_VISIBLE;
            return (
              <div className="max-h-[70vh] overflow-y-auto p-2">
                {/* Mobile: 1 kolom. sm+: 2 kolommen. lg+: 3 kolommen met thumb 112×156. */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((r) => {
                    const filteredVariants = r.variants?.filter((v) => !HIDDEN_VARIANTS.has(v)) ?? [];
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelect(r)}
                        className="flex items-start gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted/60"
                      >
                        {r.thumbnailUrl ? (
                          <Image
                            src={r.thumbnailUrl}
                            alt={r.name}
                            width={112}
                            height={156}
                            className="shrink-0 rounded-md object-cover ring-1 ring-black/5 dark:ring-white/10"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-[156px] w-[112px] shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                            -
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {r.name}
                            <span className="ml-1 font-normal text-muted-foreground">#{r.localId}</span>
                          </p>
                          {r.setName && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {r.setName}
                              {r.releaseDate && ` · ${r.releaseDate.slice(0, 4)}`}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {r.rarity && (
                              <span className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {r.rarity}
                              </span>
                            )}
                            {filteredVariants.slice(0, 3).map((v) => (
                              <span key={v} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                {VARIANT_LABEL[v] ?? v}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!expanded && hiddenCount > 0 && (
                  <div className="mt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
                    >
                      Meer weergeven (+{hiddenCount})
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>,
        document.body,
      )}
    </div>
  );
}
