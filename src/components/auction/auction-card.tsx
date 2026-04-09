import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Clock, Gavel } from "lucide-react";
import Image from "next/image";
import { parseImageUrls } from "@/lib/upload";

export interface AuctionCardData {
  id: string;
  title: string;
  auctionType: string;
  currentBid: number | null;
  startingBid: number;
  buyNowPrice: number | null;
  endTime: Date | string;
  imageUrls?: string | null;
  seller: { displayName: string };
  _count?: { bids: number };
}

export function AuctionCard({ auction, sponsored }: { auction: AuctionCardData; sponsored?: boolean }) {
  const t = useTranslations("auction");

  const images = auction.imageUrls ? parseImageUrls(auction.imageUrls) : [];
  const firstImage = images[0];

  return (
    <Link
      href={`/veilingen/${auction.id}`}
      className={`group glass overflow-hidden rounded-2xl transition-all hover:shadow-lg hover:scale-[1.01] flex flex-row sm:flex-col ${
        sponsored ? "glass-sponsored" : ""
      }`}
    >
      {/* Card image — mobile: fixed size, desktop: aspect-square with fill */}
      <div className="shrink-0 sm:relative sm:w-full sm:aspect-square bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        {firstImage ? (
          <>
            <Image src={firstImage} alt={auction.title} width={96} height={128} className="sm:hidden object-cover w-24 h-32" sizes="96px" />
            <Image src={firstImage} alt={auction.title} fill className="hidden sm:block object-cover" sizes="(max-width: 640px) 0px, (max-width: 1024px) 50vw, 25vw" />
          </>
        ) : (
          <Gavel className="h-10 w-10 text-slate-600" />
        )}
        {/* Countdown badge */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
          <CountdownPill endTime={auction.endTime} />
        </div>
        {/* Type badge */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
          <span className="rounded-md bg-primary px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-medium text-white">
            {t(({
              SINGLE_CARD: "singleCard",
              MULTI_CARD: "multiCard",
              COLLECTION: "collection",
              SEALED_PRODUCT: "sealedProduct",
              OTHER: "other",
            } as Record<string, string>)[auction.auctionType] || "other")}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {auction.title}
          </h3>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {auction.seller.displayName}
            </p>
            {sponsored && (
              <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                {t("sponsored")}
              </span>
            )}
          </div>
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
              <p className="text-xs text-muted-foreground">
                {auction._count.bids}{" "}
                {auction._count.bids === 1 ? "bod" : "biedingen"}
              </p>
            )}
            {auction.buyNowPrice && (
              <p className="mt-0.5 text-xs font-medium text-success">
                {t("buyNow")}: &euro;{auction.buyNowPrice.toFixed(2)}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
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
