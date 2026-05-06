"use client";

import { useEffect, useRef } from "react";
import { X, AlertCircle, Sparkles } from "lucide-react";
import {
  AUCTION_BUYER_PREMIUM_RATE,
  calculateBidFees,
} from "@/lib/auction/fees";
import { BID_RESERVE_RATE } from "@/lib/auction/bid-tiers";

interface Props {
  /** Bedrag dat de bidder heeft ingetypt (zonder fee). */
  bidAmount: number;
  /** Beschikbaar saldo van de bidder (na bestaande reserves). */
  availableBalance: number;
  /** Reserve die nu al staat voor deze veiling (bij hoogste-bieder of autobid). */
  ownReserveOnThisAuction: number;
  /** True = "Bod plaatsen", false = "Direct kopen" — verandert alleen labels. */
  context: "bid" | "buyNow";
  /** True = eerste bod op deze veiling — toon educatie-blokje. */
  isFirstBid: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BidConfirmationModal({
  bidAmount,
  availableBalance,
  ownReserveOnThisAuction,
  context,
  isFirstBid,
  onConfirm,
  onCancel,
}: Props) {
  const fees = calculateBidFees(bidAmount);
  const newReserve = Math.round(fees.total * BID_RESERVE_RATE * 100) / 100;
  const additionalReserveNeeded = Math.max(0, newReserve - ownReserveOnThisAuction);
  const availableAfterReserve = Math.round((availableBalance - additionalReserveNeeded) * 100) / 100;
  const insufficient = availableAfterReserve < 0;

  // Focus op confirm-knop bij open
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  // ESC sluit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const isBuyNow = context === "buyNow";
  const titleText = isBuyNow ? "Bevestig directe aankoop" : "Bevestig je bod";
  const ctaText = isBuyNow ? "Direct kopen" : "Bod bevestigen";
  const bidLabel = isBuyNow ? "Verkoopprijs" : "Jouw bod";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-foreground">{titleText}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isFirstBid && !isBuyNow && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-sky-700 dark:text-sky-400">
            <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Dit is je eerste bod op deze veiling. We tonen je éénmaal het overzicht — bij volgende bids gaat het direct.
            </span>
          </div>
        )}

        <div className="space-y-2.5 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <Row label={bidLabel} value={`€${fees.bid.toFixed(2)}`} />
          <Row
            label={`Veilingkosten (${(AUCTION_BUYER_PREMIUM_RATE * 100).toFixed(1).replace(/\.0$/, "")}%)`}
            value={`€${fees.premium.toFixed(2)}`}
            muted
          />
          <div className="border-t border-border pt-2.5">
            <Row label="Totaal bij winst" value={`€${fees.total.toFixed(2)}`} bold />
          </div>
        </div>

        {!isBuyNow && (
          <div className="mt-4 space-y-1.5 text-sm">
            <Row
              label={`Reserve op je saldo (${(BID_RESERVE_RATE * 100).toFixed(0)}%)`}
              value={`€${additionalReserveNeeded.toFixed(2)}`}
              muted
            />
            <Row
              label="Beschikbaar saldo daarna"
              value={`€${availableAfterReserve.toFixed(2)}`}
              danger={insufficient}
            />
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          {isBuyNow
            ? "Het volledige bedrag wordt nu afgeschreven van je saldo."
            : "Word je overboden, dan komt de reserve direct vrij. Win je de veiling, dan wordt het volledige bedrag (bod + veilingkosten) automatisch afgeschreven van je saldo. Heb je dan onvoldoende saldo, dan krijg je 5 dagen om aan te vullen."}
        </p>

        {insufficient && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Onvoldoende saldo voor de reserve. Top je saldo op of plaats een lager bod.</span>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Annuleren
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={onConfirm}
            disabled={insufficient}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ctaText}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
  danger,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>{label}</span>
      <span
        className={`tabular-nums ${
          bold ? "font-bold text-foreground" : danger ? "font-semibold text-rose-600 dark:text-rose-400" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// localStorage helpers — per-veiling tracking of "is dit je eerste bod?"
const STORAGE_KEY = "bid-confirmed-auctions";

export function hasConfirmedBidForAuction(auctionId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, boolean>;
    return !!map[auctionId];
  } catch {
    return false;
  }
}

export function markBidConfirmedForAuction(auctionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    map[auctionId] = true;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
