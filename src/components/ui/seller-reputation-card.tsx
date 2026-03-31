"use client";

import { useTranslations } from "next-intl";
import { StarRatingDisplay } from "@/components/ui/star-rating";
import { SellerLevelBadge } from "@/components/ui/seller-level-badge";
import { ShoppingBag, TrendingUp, Calendar, ThumbsUp } from "lucide-react";

export type SellerStats = {
  displayName: string;
  avatarUrl: string | null;
  accountType: string;
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
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {stats.displayName.charAt(0).toUpperCase()}
        </div>
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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
          {stats.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{stats.displayName}</h2>
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
