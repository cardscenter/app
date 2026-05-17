"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Zap, Trophy, AlertCircle, Eye, Check, X, Loader2, Heart, Info, Clock } from "lucide-react";
import { toast } from "sonner";
import { placeBid, setAutoBid, cancelAutoBid } from "@/actions/auction";
import { getMinimumNextBid } from "@/lib/auction/bid-increments";
import { WatchlistButton } from "@/components/ui/watchlist-button";
import { MiniCountdown } from "@/components/dashboard/mini-countdown";

// CLAUDE.md: upload.ts is server-only (fs/promises) — inline parseImageUrls
// hier zodat de client-bundle hem niet probeert te importeren.
function parseImageUrls(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface LiveBidCardData {
  id: string;
  title: string;
  imageUrls: string | null;
  currentBid: number | null;
  startingBid: number;
  endTime: Date;
  deliveryMethod: "SHIP" | "PICKUP" | "BOTH";
  /** 0 = user heeft nog niet geboden (alleen gevolgd). */
  yourBid: number;
  /** null = geen actieve autobid. */
  autoBidMax: number | null;
  isHighestBidder: boolean;
  reserveAmount: number;
  /** Of de user deze veiling expliciet volgt via Live Hub tracker. */
  isTracked: boolean;
}

function formatEuro(n: number): string {
  return `€${n.toFixed(2).replace(".", ",")}`;
}

export function LiveBidCard({ auction }: { auction: LiveBidCardData }) {
  const t = useTranslations("bids");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bidAmount, setBidAmount] = useState<string>("");
  const [showAutobid, setShowAutobid] = useState(false);
  const [autobidValue, setAutobidValue] = useState<string>(
    auction.autoBidMax !== null ? auction.autoBidMax.toFixed(2) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const images = auction.imageUrls ? parseImageUrls(auction.imageUrls) : [];
  const firstImage = images[0];
  const minimumBid = auction.currentBid === null
    ? auction.startingBid
    : getMinimumNextBid(auction.currentBid);

  // Default delivery: voor BOTH-auctions kiezen we SHIP omdat dat de meest
  // gangbare keuze is. Wil de bieder PICKUP, dan moet hij vanaf de detail-page
  // bieden zodat hij expliciet kan switchen. Voor pure PICKUP-/SHIP-auctions is
  // er geen keuze nodig.
  const deliveryChoice: "SHIP" | "PICKUP" =
    auction.deliveryMethod === "PICKUP" ? "PICKUP" : "SHIP";

  const handleQuickBid = (overrideAmount?: number) => {
    setError(null);
    const amount = overrideAmount ?? parseFloat(bidAmount);
    if (Number.isNaN(amount) || amount < minimumBid) {
      setError(t("quickBidMinHint", { min: minimumBid.toFixed(2) }));
      return;
    }
    startTransition(async () => {
      const result = await placeBid(auction.id, amount, deliveryChoice);
      if (result?.error) {
        setError(result.error);
        return;
      }
      toast.success(`Bod geplaatst: ${formatEuro(amount)}`);
      setBidAmount("");
      router.refresh();
    });
  };

  const handleSetAutobid = () => {
    setError(null);
    const amount = parseFloat(autobidValue);
    if (Number.isNaN(amount) || amount < minimumBid) {
      setError(t("quickBidMinHint", { min: minimumBid.toFixed(2) }));
      return;
    }
    startTransition(async () => {
      const result = await setAutoBid(auction.id, amount, deliveryChoice);
      if (result?.error) {
        setError(result.error);
        return;
      }
      toast.success(`Autobid ingesteld op ${formatEuro(amount)}`);
      setShowAutobid(false);
      // Server bumpt User.reservedBalance + maakt AutoBid-row — refresh haalt
      // de nieuwe state op zodat de status-pill direct naar paars flipt.
      router.refresh();
    });
  };

  const handleCancelAutobid = () => {
    startTransition(async () => {
      const result = await cancelAutoBid(auction.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Autobid gestopt");
      setAutobidValue("");
      setShowAutobid(false);
      router.refresh();
    });
  };

  return (
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
            <div className="flex shrink-0 items-center gap-1">
              {/* Status-pill — 4 mogelijke states */}
              {auction.yourBid === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30">
                  <Heart className="h-3 w-3 fill-current" />
                  {t("trackingOnly")}
                </span>
              ) : auction.isHighestBidder ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
                  <Trophy className="h-3 w-3" />
                  {t("highest")}
                </span>
              ) : auction.autoBidMax !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30">
                  <Zap className="h-3 w-3" />
                  {t("autobidArmed")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
                  <AlertCircle className="h-3 w-3" />
                  {t("outbid")}
                </span>
              )}
              {/* Untrack-knop — alleen als user actief volgt (anders verbergen) */}
              {auction.isTracked && (
                <WatchlistButton auctionId={auction.id} initialWatched={true} />
              )}
            </div>
          </div>

          {/* Prominent bid-block. Bij hoogste bieder is "Jouw bod" gelijk aan
              "Huidig bod" — dan tonen we alleen één bedrag in groen. Anders
              tonen we beide zodat het verschil duidelijk is. */}
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {t("currentBid")}
            </p>
            <p
              className={`text-2xl font-bold tabular-nums sm:text-3xl ${
                auction.isHighestBidder && auction.yourBid > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
              }`}
            >
              {formatEuro(auction.currentBid ?? 0)}
            </p>

            {/* Meta-regel: alleen tonen als er iets relevants in staat */}
            {(auction.yourBid > 0 && !auction.isHighestBidder) ||
            auction.reserveAmount > 0 ||
            auction.autoBidMax !== null ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {auction.yourBid > 0 && !auction.isHighestBidder && (
                  <span>
                    {t("yourBid")}:{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatEuro(auction.yourBid)}
                    </span>
                  </span>
                )}
                {auction.reserveAmount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    {auction.yourBid > 0 && !auction.isHighestBidder && (
                      <span className="text-border">·</span>
                    )}
                    {t("reservedHere")}:{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatEuro(auction.reserveAmount)}
                    </span>
                  </span>
                )}
                {auction.autoBidMax !== null && (
                  <span className="inline-flex items-center gap-1">
                    {(auction.yourBid > 0 || auction.reserveAmount > 0) && (
                      <span className="text-border">·</span>
                    )}
                    <Zap className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                    {t("autobidMaxLabel")}:{" "}
                    <span className="font-semibold text-violet-700 tabular-nums dark:text-violet-300">
                      {formatEuro(auction.autoBidMax)}
                    </span>
                  </span>
                )}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action-strip: quick-bid + autobid + bottom-right countdown.
          `flex-wrap` zorgt dat de Autobid/Bekijk-knoppen onder de bid-input
          schuiven zodra de card-breedte het niet meer comfortabel toelaat
          (typisch in de 2-koloms grid op lg-schermen rond 1024px). De input
          zelf krijgt een minimum-breedte zodat je altijd ~9 tekens
          (€XXXX,XX) leesbaar kunt typen. */}
      <div className="border-t border-border bg-muted/30 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Quick-bid */}
          <div className="flex flex-1 basis-full items-center gap-2 sm:basis-auto sm:min-w-[14rem]">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={minimumBid}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`${t("quickBidMinHint", { min: minimumBid.toFixed(2) })}`}
                disabled={pending}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-7 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              />
            </div>
            <button
              type="button"
              onClick={() => handleQuickBid()}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("quickBidSubmit")}
            </button>
          </div>

          {/* Autobid-toggle */}
          <button
            type="button"
            onClick={() => setShowAutobid((s) => !s)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              auction.autoBidMax !== null
                ? "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            {auction.autoBidMax !== null ? t("autobidUpdate") : t("autobidSetup")}
          </button>

          <Link
            href={`/veilingen/${auction.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Eye className="h-3.5 w-3.5" />
            {t("viewAuction")}
          </Link>
        </div>

        {/* Autobid expand-panel met uitleg */}
        {showAutobid && (
          <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800/50 dark:bg-violet-950/20">
            {/* Algemene uitleg — kort, voor de gebruiker die nog niet weet wat autobid is */}
            <div className="mb-3 flex items-start gap-2 rounded-md bg-violet-100/60 px-2.5 py-2 text-[11px] leading-relaxed text-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t("autobidExplainer")}</span>
            </div>
            {auction.autoBidMax !== null && (
              <p className="mb-2 text-xs text-violet-700 dark:text-violet-300">
                {t("autobidActiveHint", { max: auction.autoBidMax.toFixed(2) })}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-medium text-foreground">{t("autobidMaxLabel")}:</label>
              <div className="relative flex-1 min-w-[120px]">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={minimumBid}
                  value={autobidValue}
                  onChange={(e) => setAutobidValue(e.target.value)}
                  placeholder={`${minimumBid.toFixed(2)}`}
                  disabled={pending}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-7 text-sm tabular-nums focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={handleSetAutobid}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (<><Check className="h-3.5 w-3.5" /> {t("autobidSave")}</>)}
              </button>
              {auction.autoBidMax !== null && (
                <button
                  type="button"
                  onClick={handleCancelAutobid}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                  {t("autobidCancel")}
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Bottom-right countdown — tikt elke seconde voor het live-effect */}
        <div className="mt-2 flex items-center justify-end gap-1.5 text-xs">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{t("endsLabel")}:</span>
          <MiniCountdown endTime={auction.endTime} />
        </div>
      </div>
    </div>
  );
}
