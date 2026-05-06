"use client";

import { useTranslations } from "next-intl";
import { placeBid, buyNow } from "@/actions/auction";
import { getMinimumNextBid } from "@/lib/auction/bid-increments";
import { BID_RESERVE_RATE } from "@/lib/auction/bid-tiers";
import { calculateBidFees } from "@/lib/auction/fees";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { QuickBidButtons } from "@/components/auction/quick-bid-buttons";
import { Link } from "@/i18n/navigation";
import {
  BidConfirmationModal,
  hasConfirmedBidForAuction,
  markBidConfirmedForAuction,
} from "@/components/auction/bid-confirmation-modal";

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
  skipBidConfirmation = false,
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
  /** Fase 31: globale user-preference om de bid-modal helemaal over te slaan. */
  skipBidConfirmation?: boolean;
}) {
  const t = useTranslations("auction");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [bidWarning, setBidWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Fase 31: bid-modal en buy-now-modal — beide via BidConfirmationModal.
  const [pendingBid, setPendingBid] = useState<number | null>(null);
  const [pendingBuyNow, setPendingBuyNow] = useState(false);
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

  // Server geeft soms een error-code i.p.v. mensenlijke tekst (Fase 29).
  // Vertaal naar i18n; CTA-link wordt apart gerenderd voor verified-eis.
  function translateError(code: string | null): string | null {
    if (!code) return null;
    if (code === "VERIFIED_REQUIRED_FOR_HIGH_BID") return t("verifiedRequired.message");
    if (code === "BID_IP_OVERLAPS_SELLER") return t("shillProtection.message");
    return code;
  }

  async function submitBid(amount: number) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await placeBid(auctionId, amount, deliveryChoice);
      if (result?.error) {
        setError(result.error);
      } else {
        markBidConfirmedForAuction(auctionId);
        if (inputRef.current) inputRef.current.value = "";
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  async function handleBid(formData: FormData) {
    const amount = parseFloat(formData.get("bidAmount") as string);
    if (!Number.isFinite(amount) || amount <= 0) return;

    // Fase 31: toon modal bij eerste bod op deze veiling, tenzij user de
    // preference globaal heeft uitgezet.
    const skipModal = skipBidConfirmation || hasConfirmedBidForAuction(auctionId);
    if (skipModal) {
      await submitBid(amount);
    } else {
      setPendingBid(amount);
    }
  }

  function handleQuickBid(amount: number) {
    if (inputRef.current) {
      inputRef.current.value = amount.toFixed(2);
    }
  }

  async function submitBuyNow() {
    setLoading(true);
    setError(null);
    setPendingBuyNow(false);
    const result = await buyNow(auctionId, deliveryChoice);
    if (result?.error) {
      setError(result.error);
    } else {
      markBidConfirmedForAuction(auctionId);
      router.refresh();
    }
    setLoading(false);
  }

  function handleBuyNowClick() {
    // Fase 31: zelfde modal-flow als reguliere bid. Buy Now zonder bids/met
    // bids/zonder bids — alle paden tonen modal tenzij user-preference uit.
    const skipModal = skipBidConfirmation || hasConfirmedBidForAuction(auctionId);
    if (skipModal) {
      void submitBuyNow();
    } else {
      setPendingBuyNow(true);
    }
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

      {/* Bid form - hidden when highest bidder or no balance */}
      {!isHighestBidder && (maxBid === undefined || maxBid >= minimumBid) && (
        <form action={handleBid}>
          {/* Min/Max op \u00E9\u00E9n regel boven de input \u2014 voormalig
              balance-info-blok weg (saldo zichtbaar via header). Fase 32. */}
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
            <span>{t("minimumBid")}: {"\u20AC"}{minimumBid.toFixed(2)}</span>
            {maxBid !== undefined && (
              <span>{t("maxBidAmount")}: {"\u20AC"}{maxBid.toFixed(2)}</span>
            )}
          </div>
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
          {/* Quick-bid chips: vullen alleen de input \u2014 secundair gestyled
              zodat duidelijk is dat ze geen directe-bid-actie zijn. Fase 32. */}
          <div className="mt-2">
            <QuickBidButtons
              currentBid={currentBid}
              startingBid={startingBid}
              onSelect={handleQuickBid}
            />
          </div>
          {bidWarning && (
            <p className="mt-2 text-xs text-red-500 dark:text-red-400">
              {bidWarning}
            </p>
          )}
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

      {/* Buy now (Fase 31: opent BidConfirmationModal ipv inline-confirm) */}
      {buyNowPrice && (
        <button
          onClick={handleBuyNowClick}
          disabled={loading}
          className="w-full rounded-xl border-2 border-primary px-4 py-3 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-all"
        >
          {t("buyNow")} — {"\u20AC"}{buyNowPrice.toFixed(2)}
        </button>
      )}

      {/* Bid confirmation modal (Fase 31). ownReserveOnThisAuction berekent
          z'n eigen reserve (= 10% van currentBid + premium) zodat het modal
          alleen het delta-reserve toont — niet z'n eigen al-vastgehouden geld. */}
      {pendingBid !== null && (
        <BidConfirmationModal
          bidAmount={pendingBid}
          availableBalance={availableBalance ?? 0}
          ownReserveOnThisAuction={
            isHighestBidder
              ? Math.round(calculateBidFees(currentBid ?? 0).total * BID_RESERVE_RATE * 100) / 100
              : 0
          }
          context="bid"
          isFirstBid={!hasConfirmedBidForAuction(auctionId)}
          onCancel={() => setPendingBid(null)}
          onConfirm={() => {
            const a = pendingBid;
            setPendingBid(null);
            if (a !== null) void submitBid(a);
          }}
        />
      )}

      {/* Buy Now confirmation modal (Fase 31) */}
      {pendingBuyNow && buyNowPrice !== null && (
        <BidConfirmationModal
          bidAmount={buyNowPrice}
          availableBalance={availableBalance ?? 0}
          ownReserveOnThisAuction={0}
          context="buyNow"
          isFirstBid={false}
          onCancel={() => setPendingBuyNow(false)}
          onConfirm={() => void submitBuyNow()}
        />
      )}

    </div>
  );
}
