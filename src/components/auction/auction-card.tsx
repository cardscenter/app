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

export function AuctionCard({ auction }: { auction: AuctionCardData }) {
  const t = useTranslations("auction");

  const images = auction.imageUrls ? parseImageUrls(auction.imageUrls) : [];
  const firstImage = images[0];

  return (
    <Link
      href={`/veilingen/${auction.id}`}
      className="group glass overflow-hidden rounded-2xl transition-all hover:shadow-lg hover:scale-[1.01]"
    >
      {/* Card image */}
      <div className="relative h-36 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        {firstImage ? (
          <Image src={firstImage} alt={auction.title} fill className="object-cover" />
        ) : (
          <Gavel className="h-10 w-10 text-slate-600" />
        )}
        {/* Countdown badge */}
        <div className="absolute top-3 right-3">
          <CountdownPill endTime={auction.endTime} />
        </div>
        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white">
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
      <div className="p-4">
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {auction.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {auction.seller.displayName}
        </p>

        {/* Price + bids */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{t("currentBid")}</p>
            <p className="text-xl font-bold text-foreground">
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
