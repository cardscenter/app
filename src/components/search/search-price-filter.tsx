"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { FilterSection } from "@/components/ui/filter-section";

/** Compacte prijs-filter (Marktprijs min/max) voor de Kaarten-tab op
 *  /zoeken. Preserveert q + tab, reset page bij wijziging. */
export function SearchPriceFilter() {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMin = searchParams.get("minPrice") ?? "";
  const currentMax = searchParams.get("maxPrice") ?? "";

  function update(key: "minPrice" | "maxPrice", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "") params.delete(key);
    else params.set(key, value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="rounded-[12px] bg-white shadow-[0_2px_8px_0_var(--cc-border-subtle)] p-4">
      <h2 className="mb-1 text-sm font-semibold text-foreground">{t("filters")}</h2>
      <FilterSection
        title={t("priceRange")}
        count={currentMin || currentMax ? 1 : 0}
        defaultOpen
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={t("minPrice")}
            defaultValue={currentMin}
            onBlur={(e) => update("minPrice", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                update("minPrice", (e.target as HTMLInputElement).value);
            }}
            className="w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground)]/45 focus:border-[var(--foreground)] focus:outline-none min-w-0 px-2.5 py-1.5"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={t("maxPrice")}
            defaultValue={currentMax}
            onBlur={(e) => update("maxPrice", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                update("maxPrice", (e.target as HTMLInputElement).value);
            }}
            className="w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground)]/45 focus:border-[var(--foreground)] focus:outline-none min-w-0 px-2.5 py-1.5"
          />
        </div>
      </FilterSection>
    </div>
  );
}
