"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

interface SearchFiltersProps {
  cardSets: { id: string; name: string }[];
}

const CONDITIONS = [
  "Near Mint",
  "Excellent",
  "Good",
  "Light Played",
  "Heavy Played",
  "Poor",
];

export function SearchFilters({ cardSets }: SearchFiltersProps) {
  const t = useTranslations("search");
  const tc = useTranslations("conditions");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentType = searchParams.get("type") || "";
  const currentCondition = searchParams.get("condition") || "";
  const currentCardSetId = searchParams.get("cardSetId") || "";
  const currentMinPrice = searchParams.get("minPrice") || "";
  const currentMaxPrice = searchParams.get("maxPrice") || "";

  function updateFilters(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasActiveFilters =
    currentType || currentCondition || currentCardSetId || currentMinPrice || currentMaxPrice;

  const filterContent = (
    <div className="space-y-6">
      {/* Type filter */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">{t("type")}</h3>
        <div className="space-y-1.5">
          {[
            { value: "", label: t("allTypes") },
            { value: "auction", label: t("typeAuction") },
            { value: "claimsale", label: t("typeClaimsale") },
            { value: "listing", label: t("typeListing") },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => updateFilters({ type: option.value })}
              className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                currentType === option.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Condition filter */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">{t("condition")}</h3>
        <div className="space-y-1.5">
          <button
            onClick={() => updateFilters({ condition: "" })}
            className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
              !currentCondition
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t("allConditions")}
          </button>
          {CONDITIONS.map((cond) => (
            <button
              key={cond}
              onClick={() => updateFilters({ condition: cond })}
              className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                currentCondition === cond
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tc(cond)}
            </button>
          ))}
        </div>
      </div>

      {/* Set filter */}
      {cardSets.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">{t("set")}</h3>
          <select
            value={currentCardSetId}
            onChange={(e) => updateFilters({ cardSetId: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">{t("allSets")}</option>
            {cardSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Price range */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">{t("priceRange")}</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={t("minPrice")}
            defaultValue={currentMinPrice}
            onBlur={(e) => updateFilters({ minPrice: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateFilters({ minPrice: (e.target as HTMLInputElement).value });
              }
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <span className="text-muted-foreground text-sm">-</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={t("maxPrice")}
            defaultValue={currentMaxPrice}
            onBlur={(e) => updateFilters({ maxPrice: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateFilters({ maxPrice: (e.target as HTMLInputElement).value });
              }
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {t("clearFilters")}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted md:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {mobileOpen ? t("hideFilters") : t("showFilters")}
        {hasActiveFilters && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
            !
          </span>
        )}
      </button>

      {/* Mobile filter panel */}
      {mobileOpen && (
        <div className="glass rounded-xl p-4 md:hidden">
          {filterContent}
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden w-64 shrink-0 md:block">
        <div className="glass sticky top-20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground">{t("filters")}</h2>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {filterContent}
        </div>
      </div>
    </>
  );
}
