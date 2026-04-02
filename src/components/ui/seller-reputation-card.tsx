"use client";

import { useTranslations } from "next-intl";
import { StarRatingDisplay } from "@/components/ui/star-rating";
import { SellerLevelBadge } from "@/components/ui/seller-level-badge";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { ShoppingBag, TrendingUp, Calendar, ThumbsUp, Crown, Zap } from "lucide-react";

export type SellerStats = {
  displayName: string;
  avatarUrl: string | null;
  accountType: string;
  isVerified?: boolean;
  xp: number;
  avgRating: number;
  totalReviews: number;
  positivePercent: number;
  totalSales: number;
  totalPurchases: number;
  memberSince: string;
};

interface SellerReputationCardProps {
  stats: SellerStats;
  compact?: boolean;
}

export function SellerReputationCard({ stats, compact = false }: SellerReputationCardProps) {
  const t = useTranslations("reputation");

  if (compact) {
    return (
      <div className="glass-subtle flex items-center gap-3 rounded-xl p-3">
        {stats.avatarUrl ? (
          <img src={stats.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary shrink-0">
            {stats.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{stats.displayName}</span>
            <SellerLevelBadge xp={stats.xp} size="sm" isPro={stats.accountType !== "FREE"} />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {stats.totalReviews > 0 && (
              <StarRatingDisplay value={stats.avgRating} count={stats.totalReviews} size="sm" />
            )}
            <span>{stats.positivePercent}% {t("positive")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-start gap-4">
        {stats.avatarUrl ? (
          <img src={stats.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover shrink-0" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary shrink-0">
            {stats.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-foreground">{stats.displayName}</h2>
            {stats.isVerified && <VerifiedBadge />}
            {stats.accountType === "PRO" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <Zap className="h-3 w-3" /> PRO
              </span>
            )}
            {(stats.accountType === "UNLIMITED" || stats.accountType === "ADMIN") && (
              <span className="inline-flex items-center gap-1 rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-xs font-bold text-yellow-600 dark:text-yellow-400">
                <Crown className="h-3 w-3" /> UNLIMITED
              </span>
            )}
          </div>
          <div className="mt-1">
            <SellerLevelBadge xp={stats.xp} showProgress isPro={stats.accountType !== "FREE"} />
          </div>
          {stats.totalReviews > 0 && (
            <div className="mt-2">
              <StarRatingDisplay value={stats.avgRating} count={stats.totalReviews} size="md" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatItem
          icon={<ShoppingBag className="h-4 w-4" />}
          label={t("totalSales")}
          value={stats.totalSales.toString()}
        />
        <StatItem
          icon={<TrendingUp className="h-4 w-4" />}
          label={t("totalPurchases")}
          value={stats.totalPurchases.toString()}
        />
        <StatItem
          icon={<ThumbsUp className="h-4 w-4" />}
          label={t("positive")}
          value={`${stats.positivePercent}%`}
        />
        <StatItem
          icon={<Calendar className="h-4 w-4" />}
          label={t("memberSince")}
          value={stats.memberSince}
        />
      </div>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-subtle flex flex-col items-center gap-1 rounded-xl p-3 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
