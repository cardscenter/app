import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Clock, Gavel, Tag, Store } from "lucide-react";
import Image from "next/image";
import { parseImageUrls } from "@/lib/upload";
import type { SearchResult } from "@/lib/global-search";

interface SearchResultCardProps {
  result: SearchResult;
}

// Kleuren matchen de categorie-CTA's op de overzichtspagina's:
// Veilingen=blauw (primary), Marktplaats=groen (emerald), Claimsales=geel (amber).
// Zie CLAUDE.md "Page color theming".
const TYPE_STYLES = {
  auction: {
    bg: "bg-primary/90",
    icon: Gavel,
  },
  claimsale: {
    bg: "bg-amber-600/90",
    icon: Tag,
  },
  listing: {
    bg: "bg-emerald-600/90",
    icon: Store,
  },
} as const;

export function SearchResultCard({ result }: SearchResultCardProps) {
  const t = useTranslations("search");
  const ta = useTranslations("auction");

  const style = TYPE_STYLES[result.type];
  const TypeIcon = style.icon;

  const href =
    result.type === "auction"
      ? `/veilingen/${result.id}`
      : result.type === "claimsale"
        ? `/claimsales/${result.id}`
        : `/marktplaats/${result.id}`;

  const images = result.imageUrls ? parseImageUrls(result.imageUrls) : [];
  const firstImage = images[0];

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_2px_8px_0_var(--cc-border-subtle)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)]"
    >
      {/* Image area */}
      <div className="relative flex h-36 items-center justify-center bg-[var(--muted)]">
        {firstImage ? (
          <Image src={firstImage} alt={result.title} fill className="object-cover" />
        ) : (
          <TypeIcon className="h-10 w-10 text-slate-300" />
        )}

        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <span className={`rounded-md ${style.bg} px-2 py-1 text-xs font-medium text-white`}>
            {result.type === "auction"
              ? t("typeAuction")
              : result.type === "claimsale"
                ? t("typeClaimsale")
                : t("typeListing")}
          </span>
        </div>

        {/* Countdown for auctions */}
        {result.type === "auction" && result.endTime && (
          <div className="absolute top-3 right-3">
            <AuctionCountdown endTime={result.endTime} />
          </div>
        )}

        {/* Item count for claimsales */}
        {result.type === "claimsale" && result.itemCount !== undefined && (
          <div className="absolute top-3 right-3">
            <span className="rounded-md bg-black/70 px-2 py-1 text-xs text-white backdrop-blur-sm">
              {result.itemCount}/{result.totalItems}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="line-clamp-2 font-semibold text-[var(--foreground)]">
          {result.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{result.sellerName}</p>

        {/* Price section */}
        <div className="mt-3">
          {result.type === "auction" && (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{ta("currentBid")}</p>
                <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                  &euro;{(result.currentBid ?? result.startingBid ?? 0).toFixed(2)}
                </p>
              </div>
              {result.bidCount !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {result.bidCount} {result.bidCount === 1 ? "bod" : "biedingen"}
                </p>
              )}
            </div>
          )}

          {result.type === "claimsale" && result.priceRange && (
            <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {result.priceRange.min === result.priceRange.max
                ? `\u20AC${result.priceRange.min.toFixed(2)}`
                : `\u20AC${result.priceRange.min.toFixed(2)} \u2014 \u20AC${result.priceRange.max.toFixed(2)}`}
            </p>
          )}

          {result.type === "listing" && (
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                {result.pricingType === "FIXED" && result.price
                  ? `\u20AC${result.price.toFixed(2)}`
                  : "Bieden"}
              </p>
              {result.condition && (
                <span className="text-xs text-muted-foreground">{result.condition}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// Server component: "nu" per request, buiten de render-body gehouden.
function nowMs() {
  return Date.now();
}

function AuctionCountdown({ endTime }: { endTime: string }) {
  const end = new Date(endTime);
  const diff = end.getTime() - nowMs();

  if (diff <= 0)
    return (
      <span className="rounded-md bg-red-500/90 px-2 py-1 text-xs font-medium text-white">
        Afgelopen
      </span>
    );

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-mono text-white backdrop-blur-sm">
      <Clock className="size-3" />
      {days > 0 ? (
        <span>{String(days).padStart(2, "0")}d : {String(hours).padStart(2, "0")}h</span>
      ) : (
        <span>{String(hours).padStart(2, "0")}h : {String(minutes).padStart(2, "0")}m</span>
      )}
    </div>
  );
}
