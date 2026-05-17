import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  CheckCircle2,
  Clock,
  Gavel,
  Hash,
  Layers,
  MapPin,
  MessageSquare,
  Zap,
} from "lucide-react";
import { parseImageUrls } from "@/lib/upload";
import { getMinimumIncrement } from "@/lib/auction/bid-increments";
import type { AuctionCardData } from "@/components/auction/auction-card";
import { CountdownLabel } from "@/components/home/countdown-label";
import { CountryFlag } from "@/components/ui/country-flag";

const HOT_BIDS_THRESHOLD = 5;
const URGENT_MINUTES = 5;

const TYPE_LABELS_NL: Record<string, string> = {
  SINGLE_CARD: "Enkele kaart",
  MULTI_CARD: "Meerdere kaarten",
  COLLECTION: "Collectie",
  SEALED_PRODUCT: "Sealed",
  OTHER: "Overig",
};

function formatEuro(n: number): string {
  return `€${n.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type BadgeTone = "emerald" | "amber" | "rose" | "slate";

const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  emerald:
    "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  amber:
    "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
  rose:
    "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30",
  slate:
    "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-400/30",
};

function determineStatusBadge(args: {
  isUrgent: boolean;
  isHot: boolean;
  hasBuyNow: boolean;
  hasReserve: boolean;
}): { label: string; tone: BadgeTone } {
  if (args.isUrgent) return { label: "EINDIGT NU", tone: "amber" };
  if (args.isHot) return { label: "POPULAIR", tone: "rose" };
  if (args.hasBuyNow) return { label: "DIRECT KOPEN", tone: "emerald" };
  if (!args.hasReserve) return { label: "GEEN RESERVE", tone: "emerald" };
  return { label: "LIVE", tone: "slate" };
}

interface HomeAuctionCardProps {
  auction: AuctionCardData & {
    sellerId: string;
    condition?: string | null;
    reservePrice?: number | null;
    seller: AuctionCardData["seller"] & { avatarUrl?: string | null };
  };
}

export function HomeAuctionCard({ auction }: HomeAuctionCardProps) {
  const t = useTranslations("home");

  const images = auction.imageUrls ? parseImageUrls(auction.imageUrls) : [];
  const firstImage = images[0];

  const currentBid = auction.currentBid ?? auction.startingBid;
  const nextIncrementAmount = getMinimumIncrement(currentBid);

  const bidCount = auction._count?.bids ?? 0;
  const isHot = bidCount >= HOT_BIDS_THRESHOLD;

  const endTimeDate = typeof auction.endTime === "string" ? new Date(auction.endTime) : auction.endTime;
  const minutesLeft = (endTimeDate.getTime() - Date.now()) / (1000 * 60);
  const isUrgent = minutesLeft > 0 && minutesLeft <= URGENT_MINUTES;

  const hasBuyNow = !!auction.buyNowPrice && auction.buyNowPrice > 0;
  const hasReserve = !!auction.reservePrice && auction.reservePrice > 0;

  const badge = determineStatusBadge({ isUrgent, isHot, hasBuyNow, hasReserve });
  const typeLabel = TYPE_LABELS_NL[auction.auctionType] ?? "Overig";
  const refShort = auction.id.slice(0, 8).toUpperCase();
  const sellerLocation = auction.seller.city ?? auction.seller.country ?? "";

  const auctionHref = `/veilingen/${auction.id}`;
  const sellerHref = `/verkoper/${auction.sellerId}`;

  return (
    <article className="group/card relative flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-black/[0.04] transition-all hover:shadow-card-hover hover:ring-black/[0.08] dark:bg-slate-900 dark:shadow-lg dark:ring-white/[0.07] dark:hover:shadow-2xl dark:hover:ring-white/20">
      {/* Stretched main link — bedekt de hele card als default-actie */}
      <Link
        href={auctionHref}
        aria-label={`Bekijk veiling ${auction.title}`}
        className="absolute inset-0 z-10"
      />

      {/* Image met bottom-strip */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted dark:bg-slate-800">
        {firstImage ? (
          <Image
            src={firstImage}
            alt={auction.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 280px"
            className="object-cover transition-transform duration-500 group-hover/card:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Geen afbeelding
          </div>
        )}

        {/* Bottom-strip: countdown left + colored badge right */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-white via-white/85 to-transparent px-3 pb-2.5 pt-7 dark:from-slate-950 dark:via-slate-950/90">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums text-foreground dark:text-slate-200">
            <Clock className="size-3.5 text-muted-foreground dark:text-slate-400" />
            <CountdownLabel endTime={auction.endTime} />
          </span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${BADGE_TONE_CLASSES[badge.tone]}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex flex-1 flex-col px-4 pb-4 pt-3.5">
        {/* Title */}
        <h3 className="line-clamp-1 text-base font-semibold text-foreground dark:text-white">
          {auction.title}
        </h3>

        {/* Status pills */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-rose-500" />
            </span>
            {t("heroV2PillLive")}
          </span>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border dark:bg-white/5 dark:text-slate-300 dark:ring-white/10">
            {t("homeCardPillAuction")}
          </span>
          {auction.condition && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
              <CheckCircle2 className="size-3" />
              {auction.condition}
            </span>
          )}
        </div>

        {/* 2×2 spec-grid */}
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px] text-muted-foreground dark:text-slate-300">
          <SpecRow Icon={Hash} value={refShort} />
          <SpecRow Icon={Gavel} value={`${bidCount} ${t("heroCardBidsLabel")}`} />
          <SpecRow Icon={Layers} value={typeLabel} />
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="size-3.5 shrink-0 text-muted-foreground/70 dark:text-slate-500" />
            <span className="truncate">{sellerLocation || "—"}</span>
            {auction.seller.country && (
              <CountryFlag code={auction.seller.country} size="xs" className="ml-0.5" />
            )}
          </div>
        </div>

        {/* Seller-rij */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <Link
            href={sellerHref}
            className="relative z-20 flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground dark:text-slate-300 dark:hover:text-white"
            aria-label={`Bekijk verkoper ${auction.seller.displayName}`}
          >
            {auction.seller.avatarUrl ? (
              <Image
                src={auction.seller.avatarUrl}
                alt=""
                width={20}
                height={20}
                className="size-5 shrink-0 rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-1 ring-black/5 dark:bg-slate-700 dark:text-white dark:ring-white/10"
              >
                {auction.seller.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate">{auction.seller.displayName}</span>
          </Link>
          <Link
            href={sellerHref}
            className="relative z-20 flex shrink-0 items-center text-muted-foreground/70 transition-colors hover:text-foreground dark:text-slate-500 dark:hover:text-slate-200"
            aria-label={`Bericht naar ${auction.seller.displayName}`}
          >
            <MessageSquare className="size-3.5" />
          </Link>
        </div>

        {/* Bid-block */}
        <div className="mt-4 rounded-xl bg-muted/60 p-3 ring-1 ring-black/[0.04] dark:bg-slate-950/60 dark:ring-white/[0.06]">
          <div className="text-center">
            <p className="text-[10px] font-medium text-muted-foreground dark:text-slate-500">
              {t("homeCardCurrentBid")}
            </p>
            <p className="mt-0.5 text-base font-bold text-foreground dark:text-white">
              {formatEuro(currentBid)}
            </p>
          </div>

          {/* 2-col buttons — light: contrasterend (donker op licht), dark: invers (licht op donker) */}
          <div className="relative z-20 mt-3 grid grid-cols-2 gap-2">
            <Link
              href={`${auctionHref}#autobid`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Zap className="size-3.5" fill="currentColor" />
              {t("homeCardSetAutoBid")}
            </Link>
            <Link
              href={`${auctionHref}#bid`}
              className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-white shadow-md shadow-primary/30 transition-colors hover:bg-primary-hover"
            >
              {t("homeCardBidPlus")}: +{formatEuro(nextIncrementAmount)}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function SpecRow({ Icon, value }: { Icon: typeof Hash; value: string }) {
  return (
    <div className="flex items-center gap-1.5 truncate">
      <Icon className="size-3.5 shrink-0 text-muted-foreground/70 dark:text-slate-500" />
      <span className="truncate">{value}</span>
    </div>
  );
}
