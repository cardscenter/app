import Image from "next/image";
import Link from "next/link";
import { Truck, Package, Clock, Gavel } from "lucide-react";
import { parseImageUrls } from "@/lib/upload";
import { SellerLocationLine } from "@/components/ui/seller-location-line";
import { WatchlistButton } from "@/components/ui/watchlist-button";
import { AuctionLabels, type AuctionLabelData } from "@/components/auction/auction-labels";

const TYPE_LABELS_NL: Record<string, string> = {
  SINGLE_CARD: "Enkele kaart",
  MULTI_CARD: "Meerdere kaarten",
  COLLECTION: "Collectie",
  SEALED_PRODUCT: "Sealed product",
  OTHER: "Overig",
};

const HOT_BIDS_THRESHOLD = 5;

interface AuctionListRowProps {
  auction: {
    id: string;
    title: string;
    description: string | null;
    imageUrls: string | null;
    auctionType: string;
    cardName: string | null;
    condition: string | null;
    currentBid: number | null;
    startingBid: number;
    buyNowPrice: number | null;
    reservePrice: number | null;
    endTime: Date | string;
    startTime?: Date | string | null;
    status?: string;
    duration: number;
    deliveryMethod: string | null;
    pickupCity: string | null;
    createdAt: Date;
    seller: {
      id?: string;
      displayName: string;
      isVerified?: boolean;
      city?: string | null;
      postalCode?: string | null;
      country?: string | null;
    };
    _count?: { bids: number };
    labels?: AuctionLabelData[];
  };
  locale: string;
  buyer?: { country: string | null; postalCode: string | null } | null;
  initialWatched?: boolean;
  showWatchlist?: boolean;
  isSponsored?: boolean;
}

const CONDITION_COLORS: Record<string, string> = {
  Mint:
    "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800",
  "Near Mint":
    "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800",
  Excellent:
    "bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:ring-blue-800",
  Good:
    "bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:ring-blue-800",
  "Light Played":
    "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800",
  Played:
    "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800",
  Poor:
    "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:ring-rose-800",
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function formatCountdown(endTime: Date | string): { text: string; expired: boolean } {
  const end = typeof endTime === "string" ? new Date(endTime) : endTime;
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return { text: "Afgelopen", expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) {
    return {
      text: `${String(days).padStart(2, "0")}d : ${String(hours).padStart(2, "0")}h`,
      expired: false,
    };
  }
  return {
    text: `${String(hours).padStart(2, "0")}h : ${String(minutes).padStart(2, "0")}m`,
    expired: false,
  };
}

function formatScheduledStart(startTime: Date | string): string {
  const start = typeof startTime === "string" ? new Date(startTime) : startTime;
  const diff = start.getTime() - Date.now();
  if (diff <= 0) return "Start nu";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `Start over ${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0) return `Start over ${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `Start over ${minutes}m`;
}

export function AuctionListRow({
  auction,
  locale,
  buyer,
  initialWatched = false,
  showWatchlist = true,
  isSponsored = false,
}: AuctionListRowProps) {
  const images = auction.imageUrls ? parseImageUrls(auction.imageUrls) : [];
  const firstImage = images[0];
  const conditionColor = auction.condition
    ? CONDITION_COLORS[auction.condition] ?? "bg-muted text-muted-foreground ring-border"
    : null;
  const typeLabel = TYPE_LABELS_NL[auction.auctionType] ?? "Overig";
  const description = auction.description ? stripHtml(auction.description) : "";
  const bidCount = auction._count?.bids ?? 0;
  const isHot = bidCount >= HOT_BIDS_THRESHOLD;
  const isScheduled = auction.status === "SCHEDULED";
  const countdown = formatCountdown(auction.endTime);
  const scheduledText = isScheduled && auction.startTime
    ? formatScheduledStart(auction.startTime)
    : null;
  const currentPrice = auction.currentBid ?? auction.startingBid;
  const noReserve = !auction.reservePrice || auction.reservePrice === 0;

  return (
    <article
      className={`group relative flex flex-row gap-3 sm:gap-5 rounded-2xl border p-3 sm:p-4 shadow-card transition-shadow hover:shadow-card-hover ${
        isSponsored
          ? "border-amber-300 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/10"
          : "border-border bg-card"
      }`}
    >
      {isSponsored && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow">
          {locale === "en" ? "Sponsored" : "Gesponsord"}
        </span>
      )}
      {/* IMAGE met countdown-overlay + watchlist-mobile */}
      <div className="relative shrink-0">
        <Link
          href={`/${locale}/veilingen/${auction.id}`}
          className="block relative w-24 h-32 sm:w-40 sm:h-48 overflow-hidden rounded-xl bg-muted"
        >
          {firstImage ? (
            <Image
              src={firstImage}
              alt={auction.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 96px, 160px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              <Gavel className="size-6 text-muted-foreground" />
            </div>
          )}
          <span
            className={`absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold text-white shadow backdrop-blur-sm ${
              isScheduled
                ? "bg-indigo-500/90"
                : countdown.expired
                  ? "bg-red-500/90"
                  : "bg-black/70"
            }`}
          >
            <Clock className="size-3" />
            {scheduledText ?? countdown.text}
          </span>
        </Link>

        {showWatchlist && (
          <div className="absolute right-1 top-1 sm:hidden">
            <div className="rounded-full bg-background/90 p-0.5 shadow-md backdrop-blur">
              <WatchlistButton
                auctionId={auction.id}
                initialWatched={initialWatched}
              />
            </div>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex flex-1 min-w-0 flex-col">
        <Link href={`/${locale}/veilingen/${auction.id}`} className="block">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {auction.title}
            </h3>
            <span className="hidden sm:block shrink-0 text-xs text-muted-foreground tabular-nums">
              {auction.duration}d veiling
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
              {typeLabel}
            </span>
            {auction.condition && conditionColor && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${conditionColor}`}
              >
                {auction.condition}
              </span>
            )}
            {auction.cardName && (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {auction.cardName}
              </span>
            )}
          </div>

          {auction.labels && auction.labels.length > 0 && (
            <AuctionLabels
              labels={auction.labels}
              buyNowPrice={auction.buyNowPrice}
              size="md"
              className="mt-2"
            />
          )}

          {description && (
            <p className="mt-2 hidden sm:block text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
        </Link>

        {/* Mobile-only blok: prijs + delivery */}
        <div className="sm:hidden mt-2 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Huidig bod
              </p>
              <p className="text-xl font-bold text-foreground">
                €{currentPrice.toFixed(2)}
              </p>
            </div>
            <p
              className={`text-xs ${isHot ? "font-medium text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}
            >
              {isHot && <span className="mr-0.5">🔥</span>}
              {bidCount} {bidCount === 1 ? "bod" : "biedingen"}
            </p>
          </div>
          <DeliveryBadges
            deliveryMethod={auction.deliveryMethod}
            pickupCity={auction.pickupCity}
            compact
          />
        </div>

        {/* Desktop-only delivery */}
        <div className="hidden sm:flex mt-3">
          <DeliveryBadges
            deliveryMethod={auction.deliveryMethod}
            pickupCity={auction.pickupCity}
          />
        </div>

        {/* FOOTER */}
        <div className="mt-auto pt-3 border-t border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate font-medium text-foreground/80">
                {auction.seller.displayName}
              </span>
              {auction.seller.city && (
                <>
                  <span className="text-border">·</span>
                  <SellerLocationLine
                    pickupCity={auction.pickupCity}
                    deliveryMethod={auction.deliveryMethod}
                    seller={auction.seller}
                    buyer={buyer}
                    className="!mt-0"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP RIGHT — pricing + bid + watchlist.
          "Direct kopen €X" pill is hier weggehaald: sellers kopen dit nu via
          het betaalde DIRECT_KOPEN-label, dus een gratis-vermelding zou de
          waarde van die promotie ondergraven. */}
      <div className="hidden sm:flex w-48 shrink-0 flex-col items-end justify-between border-l border-border pl-5">
        <div className="flex w-full flex-col items-end gap-2">
          <div className="flex flex-col items-end gap-1">
            {noReserve && (
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                Geen reserve
              </span>
            )}
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {isScheduled ? "Startbod" : "Huidig bod"}
            </p>
            <p className="text-2xl font-bold leading-tight text-foreground tabular-nums">
              €{currentPrice.toFixed(2)}
            </p>
            {isScheduled ? (
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                Nog niet biedbaar
              </p>
            ) : (
              <p
                className={`text-xs ${isHot ? "font-medium text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}
              >
                {isHot && <span className="mr-0.5">🔥</span>}
                {bidCount} {bidCount === 1 ? "bod" : "biedingen"}
              </p>
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-2">
          {showWatchlist && (
            <WatchlistButton
              auctionId={auction.id}
              initialWatched={initialWatched}
            />
          )}
          <Link
            href={`/${locale}/veilingen/${auction.id}`}
            className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          >
            {isScheduled ? "Bekijk" : "Bied nu"}
          </Link>
        </div>
      </div>
    </article>
  );
}

function DeliveryBadges({
  deliveryMethod,
  pickupCity,
  compact = false,
}: {
  deliveryMethod: string | null;
  pickupCity: string | null;
  compact?: boolean;
}) {
  const allowsShip = deliveryMethod === "SHIP" || deliveryMethod === "BOTH" || !deliveryMethod;
  const allowsPickup = deliveryMethod === "PICKUP" || deliveryMethod === "BOTH";
  const sizeClasses = compact
    ? "px-1.5 py-0.5 text-[10px]"
    : "px-2 py-1 text-xs";
  const iconSize = compact ? "size-3" : "size-3.5";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowsShip && (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800 ${sizeClasses}`}
        >
          <Truck className={iconSize} />
          Verzenden
        </span>
      )}
      {allowsPickup && (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800 ${sizeClasses}`}
        >
          <Package className={iconSize} />
          Ophalen
          {pickupCity ? ` · ${pickupCity}` : ""}
        </span>
      )}
    </div>
  );
}
