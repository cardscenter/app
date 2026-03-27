"use client";

import { useTranslations } from "next-intl";
import { getMinimumIncrement, getMinimumNextBid } from "@/lib/auction/bid-increments";

export function QuickBidButtons({
  currentBid,
  startingBid,
  onSelect,
}: {
  currentBid: number | null;
  startingBid: number;
  onSelect: (amount: number) => void;
}) {
  const t = useTranslations("auction");
  const base = currentBid ?? 0;
  const minimumBid = base === 0 ? startingBid : getMinimumNextBid(base);
  const increment = getMinimumIncrement(base === 0 ? startingBid : base);

  // Generate 3 quick bid options: minimum, +1 increment, +2 increments
  const options = [
    minimumBid,
    +(minimumBid + increment).toFixed(2),
    +(minimumBid + increment * 2).toFixed(2),
  ];

  return (
    <div className="flex gap-2">
      {options.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onSelect(amount)}
          className="flex-1 rounded-xl border border-border/50 bg-card/50 px-3 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:bg-primary-light/50 hover:text-primary dark:hover:bg-primary/10"
        >
          {t("quickBid")} {"\u20AC"}{amount.toFixed(2)}
        </button>
      ))}
    </div>
  );
}
