"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { ClaimButton } from "@/components/claimsale/claim-button";

interface ClaimsaleItem {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  status: string;
  cardSet: {
    name: string;
    series: {
      category: { name: string };
    };
  };
  buyer: { displayName: string } | null;
}

interface ClaimsaleItemsFilterProps {
  items: ClaimsaleItem[];
  isOwner: boolean;
  isLive: boolean;
  hasSession: boolean;
}

type SortKey = "name" | "price_asc" | "price_desc" | "condition";

export function ClaimsaleItemsFilter({
  items,
  isOwner,
  isLive,
  hasSession,
}: ClaimsaleItemsFilterProps) {
  const t = useTranslations("claimsale");
  const ts = useTranslations("search");

  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");

  const conditions = useMemo(() => {
    const set = new Set(items.map((i) => i.condition));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.cardName.toLowerCase().includes(q) ||
          i.cardSet.name.toLowerCase().includes(q)
      );
    }

    // Condition filter
    if (conditionFilter) {
      result = result.filter((i) => i.condition === conditionFilter);
    }

    // Sort
    switch (sortBy) {
      case "price_asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "condition":
        result.sort((a, b) => a.condition.localeCompare(b.condition));
        break;
      case "name":
      default:
        result.sort((a, b) => a.cardName.localeCompare(b.cardName));
        break;
    }

    return result;
  }, [items, search, conditionFilter, sortBy]);

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ts("placeholder")}
            className="w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">{ts("allConditions")}</option>
          {conditions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="name">{t("cardName")}</option>
          <option value="price_asc">{ts("sortPriceLow")}</option>
          <option value="price_desc">{ts("sortPriceHigh")}</option>
          <option value="condition">{t("condition")}</option>
        </select>
      </div>

      {/* Results count */}
      <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
        {filteredItems.length}/{items.length} {t("available").toLowerCase()}
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                {t("cardName")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                Set
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                {t("condition")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                {t("price")}
              </th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                  {item.cardName}
                </td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                  {item.cardSet.series.category.name} &middot; {item.cardSet.name}
                </td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                  {item.condition}
                </td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-50">
                  &euro;{item.price.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.status === "AVAILABLE" && isLive && !isOwner && hasSession ? (
                    <ClaimButton itemId={item.id} />
                  ) : item.status === "SOLD" ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {t("claimed")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                      {t("available")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  {ts("noResultsHint")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
