"use client";

import { useState, useEffect, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import {
  CLAIMSALE_CONDITION_OPTIONS,
  CLAIMSALE_RADIUS_OPTIONS,
  ITEM_COUNT_OPTIONS,
  countActiveClaimsaleFilters,
  parseClaimsaleFilters,
} from "@/lib/claimsale-filters";

interface ClaimsalesFilterSidebarProps {
  buyerHasPostcode: boolean;
  variant?: "sidebar" | "drawer";
  onClose?: () => void;
}

export function ClaimsalesFilterSidebar({
  buyerHasPostcode,
  variant = "sidebar",
  onClose,
}: ClaimsalesFilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const filters = parseClaimsaleFilters(
    Object.fromEntries(sp.entries()) as Record<string, string>,
  );
  const activeCount = countActiveClaimsaleFilters(filters);

  const [priceMin, setPriceMin] = useState(filters.priceMin?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(filters.priceMax?.toString() ?? "");

  useEffect(() => {
    setPriceMin(filters.priceMin?.toString() ?? "");
    setPriceMax(filters.priceMax?.toString() ?? "");
  }, [filters.priceMin, filters.priceMax]);

  function updateParams(mutator: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(sp.toString());
    mutator(next);
    next.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
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
      const preserve = new URLSearchParams();
      const view = sp.get("view");
      if (view) preserve.set("view", view);
      const qs = preserve.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
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

        {/* Item-prijs */}
        <FilterSection title="Prijs per kaart" defaultOpen>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Toont sales met minstens één kaart in deze prijsrange.
          </p>
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

        {/* Conditie */}
        <FilterSection title="Conditie" count={filters.conditions.length}>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Sale matcht als minstens één kaart deze conditie heeft.
          </p>
          <div className="space-y-1.5">
            {CLAIMSALE_CONDITION_OPTIONS.map((condition) => (
              <CheckboxRow
                key={condition}
                label={condition}
                checked={filters.conditions.includes(condition)}
                onChange={() => toggleListParam("condition", condition)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Aantal items */}
        <FilterSection
          title="Grootte"
          count={filters.itemCountMin !== null ? 1 : 0}
        >
          <div className="space-y-1.5">
            <RadioRow
              label="Alle groottes"
              checked={filters.itemCountMin === null}
              onChange={() => setSingleParam("min_items", null)}
            />
            {ITEM_COUNT_OPTIONS.map((min) => (
              <RadioRow
                key={min}
                label={`${min}+ kaarten`}
                checked={filters.itemCountMin === min}
                onChange={() => setSingleParam("min_items", String(min))}
              />
            ))}
          </div>
        </FilterSection>

        {/* Afstand */}
        {buyerHasPostcode && (
          <FilterSection
            title="Afstand"
            count={filters.radius !== null ? 1 : 0}
          >
            <div className="space-y-1.5">
              <RadioRow
                label="Alle afstanden"
                checked={filters.radius === null}
                onChange={() => setSingleParam("radius", null)}
              />
              {CLAIMSALE_RADIUS_OPTIONS.map((km) => (
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
        <FilterSection title="Verkoper" count={filters.verifiedOnly ? 1 : 0}>
          <CheckboxRow
            label="Alleen geverifieerde verkopers"
            checked={filters.verifiedOnly}
            onChange={() => toggleBoolParam("verified")}
          />
        </FilterSection>

        {/* Aangeboden sinds */}
        <FilterSection
          title="Aangeboden sinds"
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

interface FilterSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

function FilterSection({
  title,
  count = 0,
  defaultOpen = false,
  children,
}: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="border-t border-border first:border-t-0 py-3"
    >
      <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-foreground list-none">
        <span className="flex items-center gap-2">
          {title}
          {count > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 rounded border-border text-primary focus:ring-primary"
      />
      <span className="flex-1">{label}</span>
    </label>
  );
}

function RadioRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground hover:bg-muted">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="size-4 border-border text-primary focus:ring-primary"
      />
      <span className="flex-1">{label}</span>
    </label>
  );
}
