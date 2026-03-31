"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SellerLevelBadge } from "@/components/ui/seller-level-badge";
import { StarRatingDisplay } from "@/components/ui/star-rating";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import {
  MapPin,
  ShoppingBag,
  Crown,
  Zap,
  ChevronRight,
} from "lucide-react";

export type SellerInfo = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  accountType: string;
  isVerified?: boolean;
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

export function SellerInfoBlock({ seller }: { seller: SellerInfo }) {
  const t = useTranslations("seller");

  return (
    <Link
      href={`/verkoper/${seller.id}`}
      className="glass-subtle flex items-center gap-4 rounded-xl p-4 transition-colors hover:bg-white/60 dark:hover:bg-white/5 group"
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
          <span className="font-semibold text-foreground truncate flex items-center gap-1">
            {seller.displayName}
            {seller.isVerified && <VerifiedBadge size="sm" />}
          </span>
          <TierBadge accountType={seller.accountType} />
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

        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          {(seller.city || seller.country) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
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
  );
}
