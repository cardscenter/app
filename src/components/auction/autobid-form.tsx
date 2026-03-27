"use client";

import { useTranslations } from "next-intl";
import { setAutoBid, cancelAutoBid } from "@/actions/auction";
import { getMinimumNextBid } from "@/lib/auction/bid-increments";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AutoBidForm({
  auctionId,
  currentBid,
  startingBid,
  existingAutoBid,
}: {
  auctionId: string;
  currentBid: number | null;
  startingBid: number;
  existingAutoBid: { maxAmount: number; isActive: boolean } | null;
}) {
  const t = useTranslations("auction");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const base = currentBid ?? 0;
  const minimumBid = base === 0 ? startingBid : getMinimumNextBid(base);

  async function handleSetAutoBid(formData: FormData) {
    setLoading(true);
    setError(null);
    const maxAmount = parseFloat(formData.get("maxAmount") as string);
    if (isNaN(maxAmount) || maxAmount < minimumBid) {
      setError(t("autoBidMinError", { amount: minimumBid.toFixed(2) }));
      setLoading(false);
      return;
    }
    const result = await setAutoBid(auctionId, maxAmount);
    if ("error" in result) {
      setError(result.error);
    } else {
      setExpanded(false);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleCancel() {
    setLoading(true);
    await cancelAutoBid(auctionId);
    router.refresh();
    setLoading(false);
  }

  // Show active autobid status
  if (existingAutoBid?.isActive) {
    return (
      <div className="glass-subtle rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("autoBidActive")}</p>
            <p className="text-xs text-muted-foreground">
              {t("autoBidMax")}: {"\u20AC"}{existingAutoBid.maxAmount.toFixed(2)}
            </p>
          </div>
          <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="w-full rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
        >
          {t("autoBidCancel")}
        </button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl border border-dashed border-border/50 px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-primary hover:text-primary"
      >
        {t("autoBidSetup")}
      </button>
    );
  }

  return (
    <div className="glass-subtle rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{t("autoBidSetup")}</p>
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {"\u2715"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t("autoBidExplain")}</p>

      {error && (
        <div className="rounded-xl bg-red-50/50 p-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <form action={handleSetAutoBid}>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-1">
            <span className="text-muted-foreground">{"\u20AC"}</span>
            <input
              name="maxAmount"
              type="number"
              step="0.01"
              min={minimumBid}
              placeholder={minimumBid.toFixed(2)}
              className="block w-full glass-input px-3 py-2.5 text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
          >
            {t("autoBidActivate")}
          </button>
        </div>
      </form>
    </div>
  );
}
