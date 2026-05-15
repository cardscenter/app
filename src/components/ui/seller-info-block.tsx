"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SellerLevelBadge } from "@/components/ui/seller-level-badge";
import { StarRatingDisplay } from "@/components/ui/star-rating";
import { TrustBadges } from "@/components/ui/trust-badges";
import { CountryFlag } from "@/components/ui/country-flag";
import {
  MapPin,
  ShoppingBag,
  Crown,
  Zap,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export type SellerInfo = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  accountType: string;
  isVerified?: boolean;
  isIbanVerified?: boolean;
  isAddressVerified?: boolean;
  xp: number;
  avgRating: number;
  totalReviews: number;
  totalSales: number;
};

function TierBadge({ accountType }: { accountType: string }) {
  if (accountType === "PRO") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
        <Zap className="h-2.5 w-2.5" /> PRO
      </span>
    );
  }
  if (accountType === "UNLIMITED" || accountType === "ADMIN") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-bold text-yellow-600 dark:text-yellow-400">
        <Crown className="h-2.5 w-2.5" /> UNLIMITED
      </span>
    );
  }
  return null;
}

interface SellerInfoBlockProps {
  seller: SellerInfo;
  /** Toon "Op kaart"-link naast de stad (Fase 27.92). Alleen aanzetten op
   *  pages waar de seller-locatie relevant is voor de koper, zoals PICKUP
   *  listings. Default uit. */
  showMapsLink?: boolean;
}

export function SellerInfoBlock({ seller, showMapsLink = false }: SellerInfoBlockProps) {
  const t = useTranslations("seller");

  // Maps-URL alleen bouwen als er een stad is en de prop aan staat.
  const mapsUrl = showMapsLink && seller.city
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(seller.city)}`
    : null;

  // Maps-link is een standalone <a>; om nesting in de outer Link te vermijden
  // splitsen we het blok in een Link-wrapper rond de hoofd-info en plaatsen
  // de Maps-link daarbuiten in een container-div.
  return (
    <div className="glass-subtle flex items-stretch rounded-xl">
      <Link
        href={`/verkoper/${seller.id}`}
        className="flex flex-1 items-center gap-4 rounded-xl p-4 transition-colors hover:bg-muted group"
      >
        {/* Avatar */}
        {seller.avatarUrl ? (
          <img
            src={seller.avatarUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary shrink-0">
            {seller.displayName.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground truncate">{seller.displayName}</span>
            <TierBadge accountType={seller.accountType} />
            <TrustBadges
              isVerified={seller.isVerified}
              isIbanVerified={seller.isIbanVerified}
              isAddressVerified={seller.isAddressVerified}
            />
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <SellerLevelBadge xp={seller.xp} size="sm" />
            {seller.totalReviews > 0 && (
              <StarRatingDisplay
                value={seller.avgRating}
                count={seller.totalReviews}
                size="sm"
              />
            )}
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
            {(seller.city || seller.country) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {seller.country && <CountryFlag code={seller.country} size="xs" />}
                {[seller.city, seller.country].filter(Boolean).join(", ")}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              {t("totalSales", { count: seller.totalSales })}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
      </Link>

      {/* Op-kaart-knop — staat naast de Link-wrapper zodat de twee anchors
          niet nesten. Externe link, opent Google Maps in nieuwe tab. */}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Bekijk ${seller.city} op kaart`}
          className="flex shrink-0 items-center gap-1 border-l border-border/60 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Op kaart</span>
        </a>
      )}
    </div>
  );
}
