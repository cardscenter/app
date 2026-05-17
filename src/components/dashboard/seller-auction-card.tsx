"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Trophy, Zap, AlertCircle, Clock, Eye, Pencil } from "lucide-react";
import { AuctionLabels, type AuctionLabelData } from "@/components/auction/auction-labels";
import { AuctionOwnerActions } from "@/components/auction/auction-owner-actions";
import { MiniCountdown } from "@/components/dashboard/mini-countdown";
import { EditAuctionDrawer, type EditAuctionInitialData } from "@/components/dashboard/edit-auction-drawer";

// CLAUDE.md: upload.ts is server-only — inline parseImageUrls.
function parseImageUrls(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatEuro(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `€${n.toFixed(2).replace(".", ",")}`;
}

function formatNlDateTime(d: Date): string {
  return d.toLocaleString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export interface SellerAuctionCardData {
  id: string;
  title: string;
  imageUrls: string | null;
  status: "ACTIVE" | "SCHEDULED";
  startingBid: number;
  currentBid: number | null;
  reservePrice: number | null;
  buyNowPrice: number | null;
  startTime: Date | null;
  endTime: Date;
  bidCount: number;
  topBidder: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    amount: number;
  } | null;
  hasReserveMet: boolean;
  labels: AuctionLabelData[];
  /** Volledige initial-data voor de edit-drawer. Komt uit page-query. */
  editData: EditAuctionInitialData;
}

interface SellerAuctionCardProps {
  auction: SellerAuctionCardData;
}

export function SellerAuctionCard({ auction }: SellerAuctionCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const images = parseImageUrls(auction.imageUrls);
  const firstImage = images[0];

  const isScheduled = auction.status === "SCHEDULED";
  const isHot = !isScheduled && auction.bidCount >= 5;
  const hasBids = auction.bidCount > 0;
  const hasReserve = (auction.reservePrice ?? 0) > 0;
  const willSell = !isScheduled && hasBids && (!hasReserve || auction.hasReserveMet);
  const underReserve = !isScheduled && hasBids && hasReserve && !auction.hasReserveMet;

  // Countdown-target: SCHEDULED telt naar startTime, ACTIVE naar endTime.
  const countdownTarget = isScheduled && auction.startTime ? auction.startTime : auction.endTime;
  const timeRemainingMs = countdownTarget.getTime() - Date.now();
  const isUrgent = timeRemainingMs > 0 && timeRemainingMs < 60 * 60 * 1000; // <1u

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {/* Top-strip: image + main info */}
        <div className="flex gap-4 p-4">
          <Link
            href={`/veilingen/${auction.id}`}
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28"
          >
            {firstImage ? (
              <Image src={firstImage} alt={auction.title} fill sizes="112px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                Geen foto
              </div>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/veilingen/${auction.id}`}
                className="line-clamp-2 text-sm font-semibold text-foreground hover:text-primary sm:text-base"
              >
                {auction.title}
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {/* Status-pill */}
                {isScheduled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30">
                    <Clock className="h-3 w-3" />
                    Wacht op start
                  </span>
                ) : !hasBids ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
                    <AlertCircle className="h-3 w-3" />
                    Geen biedingen
                  </span>
                ) : willSell ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
                    <Trophy className="h-3 w-3" />
                    Verkocht bij eind
                  </span>
                ) : underReserve ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30">
                    <AlertCircle className="h-3 w-3" />
                    Onder reserve
                  </span>
                ) : null}
                {/* Extra "Hot"-pill — bovenop andere status, niet exclusief */}
                {isHot && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30">
                    <Zap className="h-3 w-3" />
                    Hot
                  </span>
                )}
              </div>
            </div>

            {/* Labels-rij */}
            {auction.labels.length > 0 && (
              <div className="mt-2">
                <AuctionLabels labels={auction.labels} buyNowPrice={auction.buyNowPrice} size="sm" />
              </div>
            )}

            {/* Bid-block */}
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {hasBids ? "Huidig bod" : "Startbod"}
              </p>
              <p
                className={`text-2xl font-bold tabular-nums sm:text-3xl ${
                  willSell ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                }`}
              >
                {hasBids ? formatEuro(auction.currentBid) : formatEuro(auction.startingBid)}
              </p>
            </div>

            {/* Meta-row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {auction.bidCount === 0 ? "Geen biedingen" : auction.bidCount === 1 ? "1 bod" : `${auction.bidCount} biedingen`}
              </span>
              {hasReserve && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    Reserve <span className="font-medium text-foreground tabular-nums">{formatEuro(auction.reservePrice)}</span>
                  </span>
                </>
              )}
              {(auction.buyNowPrice ?? 0) > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    Direct kopen <span className="font-medium text-foreground tabular-nums">{formatEuro(auction.buyNowPrice)}</span>
                  </span>
                </>
              )}
              {isScheduled && auction.startTime && (
                <>
                  <span className="text-border">·</span>
                  <span>Start: <span className="font-medium text-foreground">{formatNlDateTime(auction.startTime)}</span></span>
                </>
              )}
            </div>

            {/* Hoogste-bieder block */}
            {auction.topBidder && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted">
                  {auction.topBidder.avatarUrl ? (
                    <Image src={auction.topBidder.avatarUrl} alt={auction.topBidder.displayName} fill sizes="24px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                      {auction.topBidder.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <span className="text-muted-foreground">Hoogste bieder: </span>
                  <Link
                    href={`/verkoper/${auction.topBidder.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {auction.topBidder.displayName}
                  </Link>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                  {formatEuro(auction.topBidder.amount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action-strip */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-3">
          <Link
            href={`/veilingen/${auction.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Eye className="h-3.5 w-3.5" />
            Bekijk biedingen
          </Link>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEditOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" />
            Pas aan
          </button>

          <AuctionOwnerActions
            auctionId={auction.id}
            bidCount={auction.bidCount}
            status={auction.status}
            variant="card"
          />

          {/* Bottom-right countdown */}
          <div className="ml-auto flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <MiniCountdown endTime={countdownTarget} urgent={isUrgent} />
          </div>
        </div>
      </div>

      <EditAuctionDrawer
        auctionId={auction.id}
        status={auction.status}
        bidCount={auction.bidCount}
        initialData={auction.editData}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
