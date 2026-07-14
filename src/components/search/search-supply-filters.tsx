"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { FilterSection, RadioRow } from "@/components/ui/filter-section";

const CONDITIONS = [
  "Near Mint",
  "Excellent",
  "Good",
  "Light Played",
  "Heavy Played",
  "Poor",
] as const;

const TYPES = ["auction", "claimsale", "listing"] as const;

/**
 * Filter-sidebar voor de Aanbod-tab op /zoeken. Gebouwd op de gedeelde
 * FilterSection/RadioRow bouwstenen (conventie voor alle overzicht-sidebars).
 * Preserveert q + tab in de URL en reset page bij elke wijziging.
 */
export function SearchSupplyFilters() {
  const t = useTranslations("search");
  const tc = useTranslations("conditions");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentType = searchParams.get("type") ?? "";
  const currentCondition = searchParams.get("condition") ?? "";
  const currentMin = searchParams.get("minPrice") ?? "";
  const currentMax = searchParams.get("maxPrice") ?? "";

  function updateFilters(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page"); // filter gewijzigd = terug naar pagina 1
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearFilters() {
    updateFilters({ type: null, condition: null, minPrice: null, maxPrice: null });
  }

  const activeCount =
    (currentType ? 1 : 0) +
    (currentCondition ? 1 : 0) +
    (currentMin || currentMax ? 1 : 0);

  const typeLabel = (type: string) =>
    type === "auction"
      ? t("typeAuction")
      : type === "claimsale"
        ? t("typeClaimsale")
        : t("typeListing");

  const panel = (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t("filters")}</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("clearFilters")}
          </button>
        )}
      </div>

      <FilterSection title={t("type")} count={currentType ? 1 : 0} defaultOpen>
        <RadioRow
          label={t("allTypes")}
          checked={currentType === ""}
          onChange={() => updateFilters({ type: null })}
        />
        {TYPES.map((type) => (
          <RadioRow
            key={type}
            label={typeLabel(type)}
            checked={currentType === type}
            onChange={() => updateFilters({ type })}
          />
        ))}
      </FilterSection>

      <FilterSection title={t("condition")} count={currentCondition ? 1 : 0}>
        <RadioRow
          label={t("allConditions")}
          checked={currentCondition === ""}
          onChange={() => updateFilters({ condition: null })}
        />
        {CONDITIONS.map((condition) => (
          <RadioRow
            key={condition}
            label={tc(condition)}
            checked={currentCondition === condition}
            onChange={() => updateFilters({ condition })}
          />
        ))}
      </FilterSection>

      <FilterSection title={t("priceRange")} count={currentMin || currentMax ? 1 : 0}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={t("minPrice")}
            defaultValue={currentMin}
            onBlur={(e) => updateFilters({ minPrice: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                updateFilters({ minPrice: (e.target as HTMLInputElement).value });
            }}
            className="w-full min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={t("maxPrice")}
            defaultValue={currentMax}
            onBlur={(e) => updateFilters({ maxPrice: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                updateFilters({ maxPrice: (e.target as HTMLInputElement).value });
            }}
            className="w-full min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </FilterSection>
    </div>
  );

  return (
    <>
      {/* Mobile: toggle-knop + inklapbaar paneel */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground"
        >
          {mobileOpen ? <X className="size-4" /> : <SlidersHorizontal className="size-4" />}
          {mobileOpen ? t("hideFilters") : t("showFilters")}
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {activeCount}
            </span>
          )}
        </button>
        {mobileOpen && <div className="mt-3">{panel}</div>}
      </div>

      {/* Desktop: sticky sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-24">{panel}</div>
      </aside>
    </>
  );
}
