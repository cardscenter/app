"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { FilterSection, CheckboxRow, RadioRow } from "@/components/ui/filter-section";
import { EVENT_COUNTRIES } from "@/lib/events/countries";
import {
  OTHER_EVENT_TYPES,
  EVENT_TYPE_LABELS_NL,
  ACTIVITY_KEYS,
  FACILITY_LABELS_NL,
  type EventType,
  type FacilityKey,
} from "@/lib/events/types";
import {
  EVENT_RADIUS_OPTIONS,
  EVENT_DATE_PRESETS,
  EVENT_DATE_PRESET_LABELS_NL,
  parseEventFilters,
  countActiveEventFilters,
} from "@/lib/event-filters";

export function EventFilterSidebar({
  buyerHasPostcode = false,
  variant = "sidebar",
  onClose,
}: {
  buyerHasPostcode?: boolean;
  variant?: "sidebar" | "drawer";
  onClose?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const filters = parseEventFilters(Object.fromEntries(sp.entries()) as Record<string, string>);
  const activeCount = countActiveEventFilters(filters);

  // Lokale custom-datum-state (alleen toegepast op blur/change).
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");
  useEffect(() => {
    setDateFrom(filters.dateFrom ?? "");
    setDateTo(filters.dateTo ?? "");
  }, [filters.dateFrom, filters.dateTo]);

  function updateParams(mutator: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(sp.toString());
    mutator(next);
    next.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function setSingleParam(key: string, value: string | null) {
    updateParams((p) => {
      if (value === null || value === "") p.delete(key);
      else p.set(key, value);
    });
  }

  function toggleListParam(key: string, value: string) {
    updateParams((p) => {
      const current = (p.get(key) ?? "").split(",").filter(Boolean);
      const idx = current.indexOf(value);
      if (idx === -1) current.push(value);
      else current.splice(idx, 1);
      if (current.length === 0) p.delete(key);
      else p.set(key, current.join(","));
    });
  }

  // Preset zetten wist de custom-range, en omgekeerd (UI laat één van beide toe).
  function setPreset(value: string | null) {
    updateParams((p) => {
      p.delete("date_from");
      p.delete("date_to");
      if (value) p.set("date_preset", value);
      else p.delete("date_preset");
    });
  }

  function commitCustomDates() {
    updateParams((p) => {
      p.delete("date_preset");
      if (dateFrom) p.set("date_from", dateFrom);
      else p.delete("date_from");
      if (dateTo) p.set("date_to", dateTo);
      else p.delete("date_to");
    });
  }

  function clearAll() {
    startTransition(() => {
      const preserve = new URLSearchParams();
      preserve.set("tab", filters.tab);
      const view = sp.get("view");
      if (view) preserve.set("view", view);
      router.push(`${pathname}?${preserve.toString()}`, { scroll: false });
    });
  }

  const hasCustomRange = !!(filters.dateFrom || filters.dateTo);

  return (
    <div className={variant === "sidebar" ? "hidden rounded-2xl border border-border bg-card p-4 shadow-card lg:block" : "p-4"}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground">Verfijn resultaten</h2>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {activeCount}
            </span>
          )}
        </div>
        {variant === "drawer" && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Sluit filters"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          disabled={isPending}
          className="mb-4 w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          Wis alle filters
        </button>
      )}

      {/* Land */}
      <FilterSection title="Land" description="Land waar het evenement plaatsvindt." defaultOpen count={filters.country ? 1 : 0}>
        <select
          value={filters.country ?? ""}
          onChange={(e) => setSingleParam("country", e.target.value || null)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          aria-label="Land"
        >
          <option value="">Alle landen</option>
          {EVENT_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.nameNl}</option>
          ))}
        </select>
      </FilterSection>

      {/* Type — alleen op de Events-tab; de Beurzen-tab toont per definitie alleen beurzen. */}
      {filters.tab === "events" && (
        <FilterSection title="Type" description="Soort evenement." defaultOpen count={filters.types.length}>
          <div className="space-y-1.5">
            {OTHER_EVENT_TYPES.map((type: EventType) => (
              <CheckboxRow
                key={type}
                label={EVENT_TYPE_LABELS_NL[type]}
                checked={filters.types.includes(type)}
                onChange={() => toggleListParam("type", type)}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Wanneer — snel-presets + optionele custom range */}
      <FilterSection
        title="Wanneer"
        description="Periode waarin het evenement valt."
        defaultOpen
        count={(filters.datePreset ? 1 : 0) + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0)}
      >
        <div className="space-y-1.5">
          <RadioRow
            label="Alles"
            checked={!filters.datePreset && !hasCustomRange}
            onChange={() => setPreset(null)}
          />
          {EVENT_DATE_PRESETS.map((preset) => (
            <RadioRow
              key={preset}
              label={EVENT_DATE_PRESET_LABELS_NL[preset]}
              checked={filters.datePreset === preset}
              onChange={() => setPreset(preset)}
            />
          ))}
        </div>
        <details open={hasCustomRange} className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Aangepaste periode
          </summary>
          <div className="mt-2 space-y-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              onBlur={commitCustomDates}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              aria-label="Vanaf"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              onBlur={commitCustomDates}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              aria-label="Tot"
            />
          </div>
        </details>
      </FilterSection>

      {/* Activiteiten */}
      <FilterSection
        title="Activiteiten"
        description="Wat je er kunt doen."
        count={filters.activities.length}
      >
        <div className="space-y-1.5">
          {ACTIVITY_KEYS.map((key: FacilityKey) => (
            <CheckboxRow
              key={key}
              label={FACILITY_LABELS_NL[key]}
              checked={filters.activities.includes(key)}
              onChange={() => toggleListParam("activities", key)}
            />
          ))}
        </div>
      </FilterSection>

      {/* Afstand — alleen voor ingelogde users met een postcode in hun profiel */}
      {buyerHasPostcode && (
        <FilterSection
          title="Afstand"
          description="Binnen hoeveel km van jouw postcode."
          count={filters.radius !== null ? 1 : 0}
        >
          <div className="space-y-1.5">
            <RadioRow
              label="Alle afstanden"
              checked={filters.radius === null}
              onChange={() => setSingleParam("radius", null)}
            />
            {EVENT_RADIUS_OPTIONS.map((km) => (
              <RadioRow
                key={km}
                label={`Binnen ${km} km`}
                checked={filters.radius === km}
                onChange={() => setSingleParam("radius", String(km))}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Entree */}
      <FilterSection title="Entree" description="Gratis of betaalde toegang." count={filters.freeOnly ? 1 : 0}>
        <CheckboxRow
          label="Alleen gratis entree"
          checked={filters.freeOnly}
          onChange={() => setSingleParam("free", filters.freeOnly ? null : "1")}
        />
      </FilterSection>
    </div>
  );
}
