"use client";

import { useTranslations } from "next-intl";
import { placeBid, buyNow } from "@/actions/auction";
import { getMinimumNextBid } from "@/lib/auction/bid-increments";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { QuickBidButtons } from "@/components/auction/quick-bid-buttons";

export function BidSection({
  auctionId,
  currentBid,
  startingBid,
  buyNowPrice,
}: {
  auctionId: string;
  currentBid: number | null;
  startingBid: number;
  buyNowPrice: number | null;
}) {
  const t = useTranslations("auction");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const minimumBid = currentBid === null ? startingBid : getMinimumNextBid(currentBid);

  async function handleBid(formData: FormData) {
    setLoading(true);
    setError(null);
    const amount = parseFloat(formData.get("bidAmount") as string);
    const result = await placeBid(auctionId, amount);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  function handleQuickBid(amount: number) {
    if (inputRef.current) {
      inputRef.current.value = amount.toFixed(2);
    }
  }

  async function handleBuyNow() {
    setLoading(true);
    setError(null);
    const result = await buyNow(auctionId);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="glass-subtle rounded-2xl bg-red-50/50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Quick bid buttons */}
      <QuickBidButtons
        currentBid={currentBid}
        startingBid={startingBid}
        onSelect={handleQuickBid}
      />

      {/* Bid form */}
      <form action={handleBid}>
        <p className="text-xs text-muted-foreground mb-2">
          {t("minimumBid")}: {"\u20AC"}{minimumBid.toFixed(2)}
        </p>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-1">
            <span className="text-muted-foreground">{"\u20AC"}</span>
            <input
              ref={inputRef}
              name="bidAmount"
              type="number"
              step="0.01"
              min={minimumBid}
              defaultValue={minimumBid}
              className="block w-full glass-input px-3 py-2.5 text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
          >
            {t("placeBid")}
          </button>
        </div>
      </form>

      {/* Buy now */}
      {buyNowPrice && (
        <button
          onClick={handleBuyNow}
          disabled={loading}
          className="w-full rounded-xl border-2 border-primary px-4 py-3 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-all"
        >
          {t("buyNow")} — {"\u20AC"}{buyNowPrice.toFixed(2)}
        </button>
      )}
    </div>
  );
}
