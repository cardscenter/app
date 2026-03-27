"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

interface SearchSortBarProps {
  resultCount: number;
  query: string;
}

export function SearchSortBar({ resultCount, query }: SearchSortBarProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") || "newest";

  function handleSortChange(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sort);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {query
          ? t("results", { count: resultCount, query })
          : `${resultCount} ${t("title").toLowerCase()}`}
      </p>
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground whitespace-nowrap">
          {t("sortBy")}:
        </label>
        <select
          value={currentSort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="newest">{t("sortNewest")}</option>
          <option value="price_asc">{t("sortPriceLow")}</option>
          <option value="price_desc">{t("sortPriceHigh")}</option>
          <option value="ending_soon">{t("sortEndingSoon")}</option>
          <option value="most_bids">{t("sortMostBids")}</option>
        </select>
      </div>
    </div>
  );
}
