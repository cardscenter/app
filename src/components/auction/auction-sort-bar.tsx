"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp } from "lucide-react";

const SORT_OPTIONS = ["newest", "ending", "highest", "bids"] as const;

const SORT_KEYS: Record<string, string> = {
  newest: "sortNewest",
  ending: "sortEndingSoon",
  highest: "sortHighestBid",
  bids: "sortMostBids",
};

export function AuctionSortBar({ currentSort, seed }: { currentSort: string; seed: number }) {
  const t = useTranslations("auction");
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSort(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sort);
    params.set("seed", String(seed));
    params.delete("page"); // reset to page 1
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowDownUp className="size-4" />
        {t("sortBy")}
      </span>
      {SORT_OPTIONS.map((option) => (
        <button
          key={option}
          onClick={() => handleSort(option)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
            currentSort === option
              ? "bg-primary text-white shadow-md"
              : "glass-subtle text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/10"
          }`}
        >
          {t(SORT_KEYS[option])}
        </button>
      ))}
    </div>
  );
}
