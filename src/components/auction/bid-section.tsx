"use client";

import { useTranslations } from "next-intl";
import { placeBid, buyNow } from "@/actions/auction";
import { getMinimumNextBid } from "@/lib/auction/bid-increments";
import { BID_RESERVE_RATE } from "@/lib/auction/bid-tiers";
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
  deliveryMethod = "SHIP",
  pickupCity = null,
}: {
  auctionId: string;
  currentBid: number | null;
  startingBid: number;
  buyNowPrice: number | null;
  availableBalance?: number;
  totalBalance?: number;
  reservedBalance?: number;
  isHighestBidder?: boolean;
  /** Fase 27.95: SHIP/PICKUP/BOTH. Bij BOTH moet bidder per bod kiezen. */
  deliveryMethod?: "SHIP" | "PICKUP" | "BOTH";
  pickupCity?: string | null;
}) {
  const t = useTranslations("auction");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [bidWarning, setBidWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBuyNowConfirm, setShowBuyNowConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Synchroon guard tegen dubbele submits: setState is async, dus tussen
  // klik 1 en de re-render-met-disabled-button kan klik 2 al binnenkomen.
  const submittingRef = useRef(false);
  // Voor BOTH: koper kiest. Voor SHIP/PICKUP: vast op die mode.
  const [deliveryChoice, setDeliveryChoice] = useState<"SHIP" | "PICKUP">(
    deliveryMethod === "PICKUP" ? "PICKUP" : "SHIP"
  );

  const minimumBid = currentBid === null ? startingBid : getMinimumNextBid(currentBid);
  // Maximum bid: 1 / BID_RESERVE_RATE × available balance (Fase 30A: 10% reserve
  // → 10× available). Was 40% (2.5×) en daarna 15% (~6.7×) — we hebben de drempel
  // verlaagd zodat bidders met klein saldo ook in het middensegment kunnen meedoen.
  const maxBid = availableBalance !== undefined ? Math.floor((availableBalance / BID_RESERVE_RATE) * 100) / 100 : undefined;
  const hasReservedFunds = (reservedBalance ?? 0) > 0;

  // Server geeft soms een error-code i.p.v. mensenlijke tekst (Fase 29).
  // Vertaal naar i18n; CTA-link wordt apart gerenderd voor verified-eis.
  function translateError(code: string | null): string | null {
    if (!code) return null;
    if (code === "VERIFIED_REQUIRED_FOR_HIGH_BID") return t("verifiedRequired.message");
    if (code === "BID_IP_OVERLAPS_SELLER") return t("shillProtection.message");
    return code;
  }

  async function handleBid(formData: FormData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const amount = parseFloat(formData.get("bidAmount") as string);
      // Voor BOTH: stuur deliveryChoice mee. Voor SHIP/PICKUP-only: backend
      // negeert de waarde en gebruikt auction.deliveryMethod.
      const result = await placeBid(auctionId, amount, deliveryChoice);
      if (result?.error) {
        setError(result.error);
      } else {
        // Geen router.refresh() — SSE-events (bid-placed + balance-changed)
        // updaten live-auction-content + UserBalance instant. Wel input clearen.
        if (inputRef.current) inputRef.current.value = "";
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
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
    const result = await buyNow(auctionId, deliveryChoice);
    if (result?.error) {
      setError(result.error);
    } else {
      // Buy-now flipt status naar BOUGHT_NOW; SSE balance-changed update header,
      // maar voor de page-state (status, ENDED-banner, payment-flow) hebben we
      // nog SSR nodig — daarom hier wel router.refresh().
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="glass-subtle rounded-2xl bg-red-50/50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          <p>{translateError(error)}</p>
          {error === "VERIFIED_REQUIRED_FOR_HIGH_BID" && (
            <Link
              href="/dashboard/verificatie"
              className="mt-2 inline-block text-xs font-medium underline hover:no-underline"
            >
              {t("verifiedRequired.cta")}
            </Link>
          )}
        </div>
      )}

      {/* Delivery-keuze (Fase 27.95) — alleen voor BOTH-veilingen waarbij
          de bidder een voorkeur op moet geven vóór bieden. */}
      {deliveryMethod === "BOTH" && !isHighestBidder && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-foreground">Hoe wil je je aankoop ontvangen?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeliveryChoice("SHIP")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                deliveryChoice === "SHIP"
                  ? "border-primary bg-primary text-white"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              Verzenden
            </button>
            <button
              type="button"
              onClick={() => setDeliveryChoice("PICKUP")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                deliveryChoice === "PICKUP"
                  ? "border-primary bg-primary text-white"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              Ophalen{pickupCity ? ` (${pickupCity})` : ""}
            </button>
          </div>
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
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t.rich("termsAcceptanceNote", {
              link: (chunks) => (
                <Link href="/veilingen/voorwaarden" className="underline hover:no-underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
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
        const reserveAmount = Math.round(buyNowPrice * BID_RESERVE_RATE * 100) / 100;
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
