"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { FilterSection, CheckboxRow, RadioRow } from "@/components/ui/filter-section";
import {
  CONDITION_OPTIONS,
  LISTING_TYPES,
  LISTING_TYPE_LABELS_NL,
  RADIUS_OPTIONS,
  countActiveFilters,
  parseListingFilters,
  type ListingType,
} from "@/lib/listing-filters";

interface MarktplaatsFilterSidebarProps {
  /** Of de buyer een postcode in z'n profiel heeft. Alleen dan tonen we de
   *  radius-filter — anders is hij betekenisloos. */
  buyerHasPostcode: boolean;
  /** Render-context: in de drawer-overlay schakelen we sticky uit en geven
   *  we een 'sluiten'-knop bovenaan. */
  variant?: "sidebar" | "drawer";
  /** Callback voor de drawer-variant zodat de sluit-knop hem dichtklapt. */
  onClose?: () => void;
}

export function MarktplaatsFilterSidebar({
  buyerHasPostcode,
  variant = "sidebar",
  onClose,
}: MarktplaatsFilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Parse current filters from URL — single source of truth.
  const filters = parseListingFilters(
    Object.fromEntries(sp.entries()) as Record<string, string>,
  );
  const activeCount = countActiveFilters(filters);

  // Local prijs-state zodat de min/max-inputs niet bij elke toets de URL
  // bombarderen. Pas op blur of Enter sturen we naar de URL.
  const [priceMin, setPriceMin] = useState(filters.priceMin?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(filters.priceMax?.toString() ?? "");

  // Sync local state als de URL extern verandert (bv. wis-knop).
  useEffect(() => {
    setPriceMin(filters.priceMin?.toString() ?? "");
    setPriceMax(filters.priceMax?.toString() ?? "");
  }, [filters.priceMin, filters.priceMax]);

  function updateParams(mutator: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(sp.toString());
    mutator(next);
    // Reset paginatie bij elke filter-wijziging.
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

  function toggleBoolParam(key: string) {
    updateParams((p) => {
      if (p.get(key) === "1") p.delete(key);
      else p.set(key, "1");
    });
  }

  function clearAll() {
    startTransition(() => {
      // Behoud view + sort, wis al het andere.
      const preserve = new URLSearchParams();
      const view = sp.get("view");
      const sort = sp.get("sort");
      if (view) preserve.set("view", view);
      if (sort) preserve.set("sort", sort);
      const qs = preserve.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function commitPrice() {
    updateParams((p) => {
      const min = priceMin.trim();
      const max = priceMax.trim();
      if (min) p.set("price_min", min);
      else p.delete("price_min");
      if (max) p.set("price_max", max);
      else p.delete("price_max");
    });
  }

  return (
    <aside
      className={
        variant === "sidebar"
          ? "hidden lg:block lg:w-72 shrink-0"
          : "block w-full"
      }
      aria-label="Filters"
    >
      <div
        className={
          variant === "sidebar"
            ? "sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-card scrollbar-none"
            : "p-4"
        }
      >
        {/* Kop: titel + counter + sluit-knop voor drawer */}
        <div className="flex items-center justify-between mb-4">
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
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Sluiten"
            >
              <X className="size-5" />
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

        {/* Prijs */}
        <FilterSection title="Prijs" description="Filter op vraagprijs (€)." defaultOpen>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center rounded-lg border border-border bg-background px-2">
              <span className="text-sm text-muted-foreground">€</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Min"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => e.key === "Enter" && commitPrice()}
                className="w-full bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <span className="text-muted-foreground">—</span>
            <div className="flex flex-1 items-center rounded-lg border border-border bg-background px-2">
              <span className="text-sm text-muted-foreground">€</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Max"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => e.key === "Enter" && commitPrice()}
                className="w-full bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>
        </FilterSection>

        {/* Type advertentie */}
        <FilterSection
          title="Type advertentie"
          description="Wat voor aanbod je zoekt."
          count={filters.types.length}
          defaultOpen
        >
          <div className="space-y-1.5">
            {LISTING_TYPES.map((type) => (
              <CheckboxRow
                key={type}
                label={LISTING_TYPE_LABELS_NL[type as ListingType]}
                checked={filters.types.includes(type)}
                onChange={() => toggleListParam("type", type)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Conditie */}
        <FilterSection title="Conditie" description="Staat van de kaart(en)." count={filters.conditions.length}>
          <div className="space-y-1.5">
            {CONDITION_OPTIONS.map((condition) => (
              <CheckboxRow
                key={condition}
                label={condition}
                checked={filters.conditions.includes(condition)}
                onChange={() => toggleListParam("condition", condition)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Verkoopvorm */}
        <FilterSection
          title="Verkoopvorm"
          description="Direct kopen tegen vaste prijs of een voorstel doen."
          count={filters.pricingModes.length}
        >
          <div className="space-y-1.5">
            <CheckboxRow
              label="Direct kopen"
              checked={filters.pricingModes.includes("DIRECT")}
              onChange={() => toggleListParam("pricing", "DIRECT")}
            />
            <CheckboxRow
              label="Bieden mogelijk"
              checked={filters.pricingModes.includes("OFFER")}
              onChange={() => toggleListParam("pricing", "OFFER")}
            />
          </div>
        </FilterSection>

        {/* Levering */}
        <FilterSection
          title="Levering"
          description="Verzonden of zelf ophalen bij de verkoper."
          count={filters.deliveryModes.length}
        >
          <div className="space-y-1.5">
            <CheckboxRow
              label="Verzenden"
              checked={filters.deliveryModes.includes("SHIP")}
              onChange={() => toggleListParam("delivery", "SHIP")}
            />
            <CheckboxRow
              label="Ophalen"
              checked={filters.deliveryModes.includes("PICKUP")}
              onChange={() => toggleListParam("delivery", "PICKUP")}
            />
          </div>
        </FilterSection>

        {/* Verzending */}
        <FilterSection
          title="Verzending"
          count={filters.freeShipping ? 1 : 0}
        >
          <CheckboxRow
            label="Alleen gratis verzending"
            checked={filters.freeShipping}
            onChange={() => toggleBoolParam("free_shipping")}
          />
        </FilterSection>

        {/* Locatie / radius — alleen voor ingelogde users met postcode */}
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
              {RADIUS_OPTIONS.map((km) => (
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

        {/* Verkoper */}
        <FilterSection
          title="Verkoper"
          description="Toon alleen ID-geverifieerde verkopers."
          count={filters.verifiedOnly ? 1 : 0}
        >
          <CheckboxRow
            label="Alleen geverifieerde verkopers"
            checked={filters.verifiedOnly}
            onChange={() => toggleBoolParam("verified")}
          />
        </FilterSection>

        {/* Aangeboden sinds */}
        <FilterSection
          title="Aangeboden sinds"
          description="Hoe recent het aanbod geplaatst is."
          count={filters.since !== "all" ? 1 : 0}
        >
          <div className="space-y-1.5">
            <RadioRow
              label="Alles"
              checked={filters.since === "all"}
              onChange={() => setSingleParam("since", null)}
            />
            <RadioRow
              label="Vandaag"
              checked={filters.since === "today"}
              onChange={() => setSingleParam("since", "today")}
            />
            <RadioRow
              label="Deze week"
              checked={filters.since === "week"}
              onChange={() => setSingleParam("since", "week")}
            />
            <RadioRow
              label="Deze maand"
              checked={filters.since === "month"}
              onChange={() => setSingleParam("since", "month")}
            />
          </div>
        </FilterSection>
      </div>
    </aside>
  );
}
