"use client";

import { useTranslations } from "next-intl";
import { placeBid, buyNow } from "@/actions/auction";
import { getMinimumNextBid } from "@/lib/auction/bid-increments";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { QuickBidButtons } from "@/components/auction/quick-bid-buttons";
import { Link } from "@/i18n/navigation";

export function BidSection({
  auctionId,
  currentBid,
  startingBid,
  buyNowPrice,
  availableBalance,
  totalBalance,
  reservedBalance,
  isHighestBidder,
}: {
  auctionId: string;
  currentBid: number | null;
  startingBid: number;
  buyNowPrice: number | null;
  availableBalance?: number;
  totalBalance?: number;
  reservedBalance?: number;
  isHighestBidder?: boolean;
}) {
  const t = useTranslations("auction");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [bidWarning, setBidWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBuyNowConfirm, setShowBuyNowConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const minimumBid = currentBid === null ? startingBid : getMinimumNextBid(currentBid);
  // Maximum bid: 2.5x available balance (since only 40% is reserved)
  const maxBid = availableBalance !== undefined ? Math.floor((availableBalance / 0.4) * 100) / 100 : undefined;
  const hasReservedFunds = (reservedBalance ?? 0) > 0;

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

  async function handleBuyNowConfirmed() {
    setLoading(true);
    setError(null);
    setShowBuyNowConfirm(false);
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

      {/* Quick bid buttons - hidden when highest bidder */}
      {!isHighestBidder && (
        <QuickBidButtons
          currentBid={currentBid}
          startingBid={startingBid}
          onSelect={handleQuickBid}
        />
      )}

      {/* No balance: deposit prompt */}
      {!isHighestBidder && maxBid !== undefined && maxBid < minimumBid && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-4 text-sm space-y-2">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            {t("noBalanceTitle")}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400/80">
            {t("noBalanceMessage")}
          </p>
          <Link
            href="/dashboard/saldo"
            className="inline-block mt-1 text-xs font-medium text-amber-700 dark:text-amber-400 underline hover:no-underline"
          >
            {t("topUpBalance")}
          </Link>
        </div>
      )}

      {/* Balance info — only when user CAN bid */}
      {!isHighestBidder && availableBalance !== undefined && maxBid !== undefined && maxBid >= minimumBid && (
        <div className="glass-subtle rounded-xl p-3 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("availableBalance")}</span>
            <span className="font-medium text-foreground">
              {"\u20AC"}{availableBalance.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("maxBidAmount")}</span>
            <span className="font-medium text-foreground">
              {"\u20AC"}{maxBid.toFixed(2)}
            </span>
          </div>
          {hasReservedFunds && (
            <p className="text-xs text-muted-foreground">
              {t("balanceReservedInfo", { amount: reservedBalance!.toFixed(2) })}
            </p>
          )}
          {bidWarning && (
            <p className="text-xs text-red-500 dark:text-red-400">
              {bidWarning}
            </p>
          )}
        </div>
      )}

      {/* Bid form - hidden when highest bidder or no balance */}
      {!isHighestBidder && (maxBid === undefined || maxBid >= minimumBid) && (
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
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (maxBid !== undefined && val > maxBid) {
                    setBidWarning(t("bidTooHighWarning", { max: maxBid.toFixed(2) }));
                  } else {
                    setBidWarning(null);
                  }
                }}
                className="block w-full glass-input px-3 py-2.5 text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !!bidWarning}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
            >
              {t("placeBid")}
            </button>
          </div>
        </form>
      )}

      {/* Buy now */}
      {buyNowPrice && !showBuyNowConfirm && (
        <button
          onClick={() => setShowBuyNowConfirm(true)}
          disabled={loading}
          className="w-full rounded-xl border-2 border-primary px-4 py-3 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-all"
        >
          {t("buyNow")} — {"\u20AC"}{buyNowPrice.toFixed(2)}
        </button>
      )}

      {/* Buy now confirmation */}
      {buyNowPrice && showBuyNowConfirm && (() => {
        const canPayFull = availableBalance !== undefined && availableBalance >= buyNowPrice;
        const reserveAmount = Math.round(buyNowPrice * 0.4 * 100) / 100;
        return (
          <div className="glass-subtle rounded-2xl border-2 border-primary/30 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground text-center">
              {t("buyNowConfirmTitle")}
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {canPayFull
                ? t("buyNowConfirmMessage", { price: buyNowPrice.toFixed(2) })
                : t("buyNowConfirmPartial", { price: buyNowPrice.toFixed(2), reserve: reserveAmount.toFixed(2) })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBuyNowConfirm(false)}
                disabled={loading}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50 transition-all"
              >
                {t("buyNowCancel")}
              </button>
              <button
                onClick={handleBuyNowConfirmed}
                disabled={loading}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
              >
                {t("buyNowConfirm")}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
