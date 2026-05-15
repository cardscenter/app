import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Clock, Gavel } from "lucide-react";
import Image from "next/image";
import { parseImageUrls } from "@/lib/upload";
import { SellerLocationLine } from "@/components/ui/seller-location-line";
import { AuctionLabels, type AuctionLabelData } from "@/components/auction/auction-labels";

// Drempel waarboven een veiling als "hot" gemarkeerd wordt met een 🔥-emoji
// in de bid-counter. Empirisch bepaald op de seed-data — mediaan ligt op 1-3,
// dus 5+ biedingen onderscheidt zich duidelijk.
const HOT_BIDS_THRESHOLD = 5;

const TYPE_KEYS: Record<string, string> = {
  SINGLE_CARD: "singleCard",
  MULTI_CARD: "multiCard",
  COLLECTION: "collection",
  SEALED_PRODUCT: "sealedProduct",
  OTHER: "other",
};

export interface AuctionCardData {
  id: string;
  title: string;
  auctionType: string;
  currentBid: number | null;
  startingBid: number;
  buyNowPrice: number | null;
  endTime: Date | string;
  startTime?: Date | string | null;
  status?: string;
  imageUrls?: string | null;
  deliveryMethod?: string | null;
  pickupCity?: string | null;
  seller: {
    displayName: string;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  _count?: { bids: number };
  labels?: AuctionLabelData[];
}

interface AuctionCardProps {
  auction: AuctionCardData;
  sponsored?: boolean;
  buyer?: { country: string | null; postalCode: string | null } | null;
}

export function AuctionCard({ auction, sponsored, buyer }: AuctionCardProps) {
  const t = useTranslations("auction");

  const images = auction.imageUrls ? parseImageUrls(auction.imageUrls) : [];
  const firstImage = images[0];
  const bidCount = auction._count?.bids ?? 0;
  const isHot = bidCount >= HOT_BIDS_THRESHOLD;
  const typeLabel = t(TYPE_KEYS[auction.auctionType] || "other");

  return (
    <Link
      href={`/veilingen/${auction.id}`}
      className={`group glass overflow-hidden rounded-2xl transition-all hover:shadow-lg hover:scale-[1.01] flex flex-row sm:flex-col ${
        sponsored ? "glass-sponsored" : ""
      }`}
    >
      {/* Card image — mobile: fixed size, desktop: aspect-square with fill.
          Type-badge staat NIET meer over de image (Fase 27.90) — die viel
          over de countdown. Nu in de body als pill naast de seller-naam. */}
      <div className="shrink-0 sm:relative sm:w-full sm:aspect-square bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        {firstImage ? (
          <>
            <Image src={firstImage} alt={auction.title} width={96} height={128} className="sm:hidden object-cover w-24 h-32" sizes="96px" />
            <Image src={firstImage} alt={auction.title} fill className="hidden sm:block object-cover" sizes="(max-width: 640px) 0px, (max-width: 1024px) 50vw, 25vw" />
          </>
        ) : (
          <Gavel className="h-10 w-10 text-slate-600" />
        )}
        {/* Countdown badge — voor SCHEDULED toont 'ie "Start over Xd" ipv
            de end-countdown, met indigo-tint zodat de seller direct ziet
            dat deze veiling nog niet biedbaar is. */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
          {auction.status === "SCHEDULED" && auction.startTime ? (
            <ScheduledStartPill startTime={auction.startTime} />
          ) : (
            <CountdownPill endTime={auction.endTime} />
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {auction.title}
          </h3>
          {/* Seller + type-pill + sponsored — type-pill is muted zodat hij
              niet concurreert met andere accent-kleuren in de card. */}
          <div className="mt-1 flex items-center gap-1.5 justify-between">
            <p className="truncate text-xs text-muted-foreground">
              {auction.seller.displayName}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {typeLabel}
              </span>
              {sponsored && (
                <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                  {t("sponsored")}
                </span>
              )}
            </div>
          </div>
          <SellerLocationLine
            pickupCity={auction.pickupCity}
            deliveryMethod={auction.deliveryMethod}
            seller={auction.seller}
            buyer={buyer}
          />
          {auction.labels && auction.labels.length > 0 && (
            <AuctionLabels
              labels={auction.labels}
              buyNowPrice={auction.buyNowPrice}
              size="sm"
              className="mt-1.5"
            />
          )}
        </div>

        {/* Price + bids */}
        <div className="mt-2 sm:mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{t("currentBid")}</p>
            <p className="text-lg sm:text-xl font-bold text-foreground">
              &euro;{(auction.currentBid ?? auction.startingBid).toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            {auction._count && (
              <p className={`text-xs ${isHot ? "font-medium text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
                {isHot && <span className="mr-0.5">🔥</span>}
                {bidCount}{" "}
                {bidCount === 1 ? "bod" : "biedingen"}
              </p>
            )}
            {/* "Direct Kopen €X" tonen we niet meer gratis op de card —
                sellers kopen dit nu via het betaalde DIRECT_KOPEN-label
                (auction.labels). */}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ScheduledStartPill({ startTime }: { startTime: Date | string }) {
  const start = typeof startTime === "string" ? new Date(startTime) : startTime;
  const diff = start.getTime() - Date.now();
  if (diff <= 0) {
    // Edge-case: scheduled-status maar startTime al gepasseerd (cron heeft 'm
    // nog niet geflipt). Toon "start nu" zodat het niet raar leeg blijft.
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/90 px-2 py-1 text-xs font-medium text-white">
        <Clock className="size-3" />
        Start nu
      </span>
    );
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const text =
    days > 0
      ? `Start over ${days}d ${String(hours).padStart(2, "0")}h`
      : hours > 0
        ? `Start over ${hours}h ${String(minutes).padStart(2, "0")}m`
        : `Start over ${minutes}m`;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/90 px-2 py-1 text-xs font-mono font-medium text-white shadow backdrop-blur-sm">
      <Clock className="size-3" />
      {text}
    </span>
  );
}

function CountdownPill({ endTime }: { endTime: Date | string }) {
  const end = typeof endTime === "string" ? new Date(endTime) : endTime;
  const diff = end.getTime() - Date.now();
  if (diff <= 0)
    return (
      <span className="rounded-md bg-red-500/90 px-2 py-1 text-xs font-medium text-white">
        Afgelopen
      </span>
    );

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-mono text-white backdrop-blur-sm">
      <Clock className="size-3" />
      {days > 0 ? (
        <span>
          {String(days).padStart(2, "0")}d : {String(hours).padStart(2, "0")}h
        </span>
      ) : (
        <span>
          {String(hours).padStart(2, "0")}h :{" "}
          {String(minutes).padStart(2, "0")}m
        </span>
      )}
    </div>
  );
}
