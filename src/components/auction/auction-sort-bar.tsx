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
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <ArrowDownUp className="size-4 text-muted-foreground" />
      <select
        value={currentSort}
        onChange={(e) => handleSort(e.target.value)}
        className="glass-input rounded-lg px-3 py-1.5 text-sm font-medium text-foreground cursor-pointer"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(SORT_KEYS[option])}
          </option>
        ))}
      </select>
    </div>
  );
}
