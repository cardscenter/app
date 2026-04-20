"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Search, Loader2, X, ChevronDown, SlidersHorizontal, RotateCcw, AlertTriangle } from "lucide-react";
import { cardSlug } from "@/lib/card-helpers";
import { cn } from "@/lib/utils";

import { getMarktprijs, getMarktprijsReverseHolo } from "@/lib/display-price";
import { hasReverseHoloSignal } from "@/lib/buyback-pricing";

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
  priceLow: number | null;
  priceTrend: number | null;
  priceAvg7: number | null;
  priceAvg30: number | null;
  priceReverseAvg: number | null;
  priceReverseLow: number | null;
  priceReverseTrend: number | null;
  priceReverseAvg7: number | null;
  priceReverseAvg30: number | null;
  priceTcgplayerNormalMarket: number | null;
  priceTcgplayerHolofoilMarket: number | null;
  priceTcgplayerReverseMarket: number | null;
  priceTcgplayerReverseMid: number | null;
  priceOverrideAvg: number | null;
  priceOverrideReverseAvg: number | null;
  variants: string | null;
}

const FOIL_RE = /\b(holo|hyper|ultra|full art|illustration|special|double|amazing|radiant|shiny|secret|rainbow)\b/i;

function isFoilRarity(rarity: string | null): boolean {
  return FOIL_RE.test(rarity ?? "");
}

function effectivePrice(c: SearchResult): number | null {
  if (isFoilRarity(c.rarity)) {
    const rh = getMarktprijsReverseHolo(c);
    if (rh !== null) return rh;
  }
  return getMarktprijs(c);
}

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;
// Must match MAX_RESULTS in src/app/api/cards/search/route.ts
const RESULT_CAP = 300;

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

// ============================================================
// Advanced-search filter shape + static option catalogs
// ============================================================

type Filters = {
  priceMin: string;
  priceMax: string;
  hpMin: string;
  hpMax: string;
  yearMin: string;
  yearMax: string;
  seriesId: string;
  setId: string;
  illustrator: string;
  category: string; // "", "Pokemon", "Trainer", "Energy"
  types: string[];
  rarities: string[];
  regulationMarks: string[];
};

const DEFAULT_YEAR_MIN = "1996";
const DEFAULT_YEAR_MAX = String(new Date().getFullYear());

const EMPTY_FILTERS: Filters = {
  priceMin: "",
  priceMax: "",
  hpMin: "",
  hpMax: "",
  yearMin: DEFAULT_YEAR_MIN,
  yearMax: DEFAULT_YEAR_MAX,
  seriesId: "",
  setId: "",
  illustrator: "",
  category: "",
  types: [],
  rarities: [],
  regulationMarks: [],
};

// Standard Pokémon TCG energy types → icon filename in /images/sets/types/.
// "Colorless" maps to Normal.png. Volgorde volgens de klassieke TCG-layout.
const TYPE_OPTIONS: { key: string; icon: string }[] = [
  { key: "Grass", icon: "Grass" },
  { key: "Fire", icon: "Fire" },
  { key: "Water", icon: "Water" },
  { key: "Lightning", icon: "Lightning" },
  { key: "Psychic", icon: "Psychic" },
  { key: "Fighting", icon: "Fighting" },
  { key: "Darkness", icon: "Darkness" },
  { key: "Metal", icon: "Metal" },
  { key: "Dragon", icon: "Dragon" },
  { key: "Fairy", icon: "Fairy" },
  { key: "Colorless", icon: "Normal" },
];

const REG_MARK_OPTIONS = ["D", "E", "F", "G", "H"];

const CATEGORY_OPTIONS = [
  { value: "Pokemon", label: "Pokémon" },
  { value: "Trainer", label: "Trainer" },
  { value: "Energy", label: "Energy" },
];

function filtersAreEmpty(f: Filters): boolean {
  const yearDefault =
    (f.yearMin === "" || f.yearMin === DEFAULT_YEAR_MIN) &&
    (f.yearMax === "" || f.yearMax === DEFAULT_YEAR_MAX);
  return (
    f.priceMin === "" && f.priceMax === "" &&
    f.hpMin === "" && f.hpMax === "" &&
    yearDefault &&
    f.seriesId === "" && f.setId === "" &&
    f.illustrator === "" && f.category === "" &&
    f.types.length === 0 && f.rarities.length === 0 &&
    f.regulationMarks.length === 0
  );
}

function buildSearchUrl(q: string, f: Filters): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (f.priceMin) params.set("priceMin", f.priceMin);
  if (f.priceMax) params.set("priceMax", f.priceMax);
  if (f.hpMin) params.set("hpMin", f.hpMin);
  if (f.hpMax) params.set("hpMax", f.hpMax);
  if (f.yearMin) params.set("yearMin", f.yearMin);
  if (f.yearMax) params.set("yearMax", f.yearMax);
  if (f.seriesId) params.set("seriesId", f.seriesId);
  if (f.setId) params.set("setId", f.setId);
  if (f.illustrator) params.set("illustrator", f.illustrator);
  if (f.category) params.set("category", f.category);
  if (f.types.length) params.set("types", f.types.join(","));
  if (f.rarities.length) params.set("rarities", f.rarities.join(","));
  if (f.regulationMarks.length) params.set("regulationMarks", f.regulationMarks.join(","));
  params.set("limit", "500");
  return `/api/cards/search?${params.toString()}`;
}

// ============================================================

interface Props {
  children: React.ReactNode;
  rarityOptions: string[];
  seriesOptions: { id: string; name: string; sets: { id: string; name: string }[] }[];
}

export function KaartenSearch({ children, rarityOptions, seriesOptions }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Anchor used to scroll the page to the results block after an
  // advanced-search submit.
  const resultsAnchorRef = useRef<HTMLDivElement>(null);

  // Advanced-search state
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters | null>(null);
  const [appliedQuery, setAppliedQuery] = useState<string>("");

  const trimmed = query.trim();
  const hasBasicQuery = trimmed.length >= MIN_QUERY;
  const hasAppliedAdvanced = appliedFilters !== null;
  const hasResults = hasBasicQuery || hasAppliedAdvanced;

  // Live search effect — only active when advanced is NOT applied.
  // Advanced mode uses an explicit Zoeken-click to fire a fetch instead.
  useEffect(() => {
    if (hasAppliedAdvanced) return;
    if (trimmed.length < MIN_QUERY) {
      setResults([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(buildSearchUrl(trimmed, EMPTY_FILTERS), {
          signal: controller.signal,
        });
        if (!res.ok) {
          setResults([]);
          setTotalCount(0);
          return;
        }
        const data = await res.json();
        setResults(data.results ?? []);
        setTotalCount(data.totalCount ?? 0);
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
  }, [trimmed, hasAppliedAdvanced]);

  const runAdvancedSearch = async () => {
    setAppliedFilters(draftFilters);
    setAppliedQuery(trimmed);
    setLoading(true);
    try {
      const res = await fetch(buildSearchUrl(trimmed, draftFilters));
      if (!res.ok) {
        setResults([]);
        setTotalCount(0);
        return;
      }
      const data = await res.json();
      setResults(data.results ?? []);
      setTotalCount(data.totalCount ?? 0);
    } finally {
      setLoading(false);
      // Wait for the results block to mount before scrolling — setTimeout
      // runs after React commits the state updates above.
      setTimeout(() => {
        resultsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  const resetAdvanced = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(null);
    setAppliedQuery("");
    setResults([]);
    setTotalCount(0);
  };

  // Closing the panel clears the draft filters and the applied snapshot,
  // but keeps whatever the user typed — so live-search picks up again if
  // the query still has >= MIN_QUERY chars.
  const closeAdvanced = () => {
    setAdvancedOpen(false);
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(null);
  };

  // Show the "Geavanceerd zoeken" button inside the search bar when the
  // text input is empty AND the advanced panel isn't currently open.
  const showAdvancedButton = trimmed === "" && !advancedOpen;

  return (
    <>
      <div className="mb-8">
        {!advancedOpen && (
          <>
            {/* Mobile: full-width button boven de zoekbalk zodat er genoeg
                ruimte overblijft voor de zoekopdracht. Op desktop gebruiken
                we de inline variant (rechts in de input). */}
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              className="mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 md:hidden"
            >
              <SlidersHorizontal className="size-4" />
              Geavanceerd zoeken
            </button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Zoek op naam, set of nummer (bv. "Charizard", "Base Set", "4")'
                className={cn(
                  "w-full rounded-xl border border-border bg-card py-3 pl-12 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary",
                  // Mobile: alleen ruimte voor het kruisje (pr-12). Desktop: ruimte
                  // voor de inline "Geavanceerd zoeken" knop wanneer die getoond wordt.
                  "pr-12",
                  showAdvancedButton ? "md:pr-52" : "md:pr-20"
                )}
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
              {showAdvancedButton && (
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 hidden items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 md:inline-flex"
                >
                  <SlidersHorizontal className="size-3.5" />
                  Geavanceerd zoeken
                </button>
              )}
            </div>
          </>
        )}

        {advancedOpen && (
          <AdvancedPanel
            query={query}
            setQuery={setQuery}
            draft={draftFilters}
            setDraft={setDraftFilters}
            rarityOptions={rarityOptions}
            seriesOptions={seriesOptions}
            onSubmit={runAdvancedSearch}
            onReset={() => setDraftFilters(EMPTY_FILTERS)}
            onClose={closeAdvanced}
          />
        )}
      </div>

      {hasResults ? (
        <>
          <div ref={resultsAnchorRef} className="scroll-mt-24" />
          <SearchResults
            results={results}
            totalCount={totalCount}
            loading={loading}
            query={hasAppliedAdvanced ? appliedQuery : trimmed}
            appliedFilters={hasAppliedAdvanced ? appliedFilters : null}
          />
        </>
      ) : (
        children
      )}
    </>
  );
}

// ============================================================
// Advanced-search panel
// ============================================================

function AdvancedPanel({
  query,
  setQuery,
  draft,
  setDraft,
  rarityOptions,
  seriesOptions,
  onSubmit,
  onReset,
  onClose,
}: {
  query: string;
  setQuery: (v: string) => void;
  draft: Filters;
  setDraft: (f: Filters | ((prev: Filters) => Filters)) => void;
  rarityOptions: string[];
  seriesOptions: { id: string; name: string; sets: { id: string; name: string }[] }[];
  onSubmit: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const toggleInArray = (key: keyof Filters, value: string) => {
    setDraft((prev) => {
      const current = prev[key] as string[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const setField = (key: keyof Filters, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  // Changing the series invalidates the currently-selected set unless it
  // belongs to that series, so we clear it to avoid stale combinations.
  const onSeriesChange = (newSeriesId: string) => {
    setDraft((prev) => ({ ...prev, seriesId: newSeriesId, setId: "" }));
  };

  const availableSets = draft.seriesId
    ? seriesOptions.find((s) => s.id === draft.seriesId)?.sets ?? []
    : null;

  const canSubmit = query.trim().length >= MIN_QUERY || !filtersAreEmpty(draft);

  return (
    <div
      ref={panelRef}
      className="glass-subtle rounded-2xl border border-border p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Geavanceerd zoeken</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Sluiten"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Primary text query — moved into the panel while advanced mode is open */}
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Zoek op naam, set of nummer (bv. "Charizard", "Base Set", "4")'
          className="w-full rounded-xl border border-border bg-card py-3 pl-12 pr-10 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Prijs */}
        <FieldGroup label="Marktprijs (€)">
          <div className="flex items-center gap-2">
            <NumberInput
              placeholder="min"
              value={draft.priceMin}
              onChange={(v) => setField("priceMin", v)}
            />
            <span className="text-muted-foreground">–</span>
            <NumberInput
              placeholder="max"
              value={draft.priceMax}
              onChange={(v) => setField("priceMax", v)}
            />
          </div>
        </FieldGroup>

        {/* HP */}
        <FieldGroup label="HP">
          <div className="flex items-center gap-2">
            <NumberInput
              placeholder="min"
              value={draft.hpMin}
              onChange={(v) => setField("hpMin", v)}
            />
            <span className="text-muted-foreground">–</span>
            <NumberInput
              placeholder="max"
              value={draft.hpMax}
              onChange={(v) => setField("hpMax", v)}
            />
          </div>
        </FieldGroup>

        {/* Releasejaar */}
        <FieldGroup label="Releasejaar (t/m)">
          <div className="flex items-center gap-2">
            <NumberInput
              placeholder="van"
              value={draft.yearMin}
              onChange={(v) => setField("yearMin", v)}
            />
            <span className="text-muted-foreground">–</span>
            <NumberInput
              placeholder="tot"
              value={draft.yearMax}
              onChange={(v) => setField("yearMax", v)}
            />
          </div>
        </FieldGroup>

        {/* Serie */}
        <FieldGroup label="Serie">
          <select
            value={draft.seriesId}
            onChange={(e) => onSeriesChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Alle series</option>
            {seriesOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FieldGroup>

        {/* Set */}
        <FieldGroup label="Set">
          <select
            value={draft.setId}
            onChange={(e) => setField("setId", e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Alle sets</option>
            {availableSets
              ? availableSets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.name}
                  </option>
                ))
              : seriesOptions.map((s) => (
                  <optgroup key={s.id} label={s.name}>
                    {s.sets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
          </select>
        </FieldGroup>

        {/* Illustrator */}
        <FieldGroup label="Illustrator">
          <input
            type="text"
            value={draft.illustrator}
            onChange={(e) => setField("illustrator", e.target.value)}
            placeholder="bv. Mitsuhiro Arita"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </FieldGroup>

        {/* Category */}
        <FieldGroup label="Categorie">
          <div className="flex flex-wrap gap-2">
            <Chip
              active={draft.category === ""}
              onClick={() => setField("category", "")}
              label="Alle"
            />
            {CATEGORY_OPTIONS.map((c) => (
              <Chip
                key={c.value}
                active={draft.category === c.value}
                onClick={() => setField("category", c.value)}
                label={c.label}
              />
            ))}
          </div>
        </FieldGroup>
      </div>

      {/* Types — icon-only chips */}
      <FieldGroup label="Pokémon type" className="mt-5">
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((t) => (
            <TypeChip
              key={t.key}
              active={draft.types.includes(t.key)}
              onClick={() => toggleInArray("types", t.key)}
              name={t.key}
              iconFile={t.icon}
            />
          ))}
        </div>
      </FieldGroup>

      {/* Regulation mark */}
      <FieldGroup label="Regulation mark" className="mt-5">
        <div className="flex flex-wrap gap-2">
          {REG_MARK_OPTIONS.map((m) => (
            <Chip
              key={m}
              active={draft.regulationMarks.includes(m)}
              onClick={() => toggleInArray("regulationMarks", m)}
              label={m}
            />
          ))}
        </div>
      </FieldGroup>

      {/* Rarities */}
      {rarityOptions.length > 0 && (
        <FieldGroup label="Zeldzaamheid" className="mt-5">
          <div className="flex flex-wrap gap-2">
            {rarityOptions.map((r) => (
              <Chip
                key={r}
                active={draft.rarities.includes(r)}
                onClick={() => toggleInArray("rarities", r)}
                label={r}
              />
            ))}
          </div>
        </FieldGroup>
      )}

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          <RotateCcw className="size-3.5" />
          Resetten
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="size-3.5" />
          Zoeken
        </button>
      </div>
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  name,
  iconFile,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  iconFile: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      aria-label={name}
      aria-pressed={active}
      className={cn(
        "relative block size-11 overflow-hidden rounded-full transition-all",
        active
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "opacity-70 hover:opacity-100"
      )}
    >
      <Image
        src={`/images/sets/types/${iconFile}.png`}
        alt={name}
        width={44}
        height={44}
        className="size-full object-cover"
        unoptimized
      />
    </button>
  );
}

function FieldGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
    />
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:bg-muted/60"
      )}
    >
      {label}
    </button>
  );
}

// ============================================================

function SearchResults({
  results,
  totalCount,
  loading,
  query,
  appliedFilters,
}: {
  results: SearchResult[];
  totalCount: number;
  loading: boolean;
  query: string;
  appliedFilters: Filters | null;
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
  // Soft cap: backend returns empty results when matches exceed the cap.
  // Ask the user to narrow their query rather than dumping a huge grid.
  if (!loading && totalCount > RESULT_CAP) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1">
          <p className="font-semibold">
            Te veel resultaten ({totalCount.toLocaleString("nl-NL")} kaarten)
          </p>
          <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
            Verfijn je zoekopdracht — bv. een specifiekere naam, een serie of set,
            een prijs- of jaarbereik — om resultaten te zien.
          </p>
        </div>
      </div>
    );
  }
  if (!loading && results.length === 0) {
    const desc = query
      ? `voor "${query}"`
      : appliedFilters
        ? "met deze filters"
        : "";
    return (
      <div className="glass-subtle rounded-2xl p-12 text-center text-muted-foreground">
        Geen kaarten gevonden {desc}.
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
                  {(() => {
                    if (isFoilRarity(card.rarity)) return null;
                    if (!hasReverseHoloSignal(card)) return null;
                    const rh = getMarktprijsReverseHolo(card);
                    if (rh === null) return null;
                    return (
                      <span className="inline-flex items-center gap-0.5 text-xs tabular-nums text-purple-600 dark:text-purple-400">
                        <span className="font-medium">Reverse</span> €{rh.toFixed(2)}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
