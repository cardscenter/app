import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSellerStats, getSellerReviews } from "@/actions/review";
import { SellerReputationCard } from "@/components/ui/seller-reputation-card";
import { ReviewList } from "@/components/ui/review-list";
import { SELLER_LEVELS } from "@/lib/seller-levels";
import { getLevel, getNextLevel } from "@/lib/seller-levels";

export default async function DashboardReviewsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session!.user!.id!;
  const t = await getTranslations("reputation");
  const tCommon = await getTranslations("common");
  const stats = await getSellerStats(userId);
  const reviews = await getSellerReviews(userId);

  if (!stats) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {tCommon("error")}
      </div>
    );
  }

  const currentLevel = getLevel(stats.xp);
  const nextLevel = getNextLevel(stats.xp);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("myReputation")}</h1>

      <SellerReputationCard stats={stats} />

      {/* Level progression */}
      <div className="glass rounded-2xl p-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">{t("levelProgression")}</h3>
        <div className="flex flex-wrap gap-3">
          {SELLER_LEVELS.map((level) => {
            const isActive = level.nameKey === currentLevel.nameKey;
            const isLocked = stats.xp < level.minXP;
            return (
              <div
                key={level.nameKey}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? `${level.bgColor} ${level.borderColor} ${level.color} ring-2 ring-primary/30`
                    : isLocked
                      ? "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-600"
                      : `${level.bgColor} ${level.borderColor} ${level.color}`
                }`}
              >
                <span className={isLocked ? "grayscale" : ""}>{level.icon}</span>
                <span>{level.name}</span>
                <span className="text-xs opacity-70">{level.minXP} XP</span>
              </div>
            );
          })}
        </div>
        {nextLevel && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("xpToNextLevel", { xp: nextLevel.minXP - stats.xp, level: nextLevel.name })}
          </p>
        )}
      </div>

      {/* XP Breakdown */}
      <div className="glass rounded-2xl p-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">{t("xpBreakdown")}</h3>
        <div className="space-y-3">
          <XPRow label={t("xpAccountAge")} value={stats.xpBreakdown.accountAge} detail={t("xpDetailAccountAge")} />
          <XPRow label={t("xpSales")} value={stats.xpBreakdown.sales} detail={t("xpDetailSales")} />
          <XPRow label={t("xpPurchases")} value={stats.xpBreakdown.purchases} detail={t("xpDetailPurchases")} />
          <XPRow label={t("xpReviews")} value={stats.xpBreakdown.positiveReviews} detail={t("xpDetailReviews")} />
          <div className="border-t border-white/10 pt-3">
            <XPRow label={t("xpTotal")} value={stats.xp} bold />
          </div>
        </div>
      </div>

      {/* Reviews received */}
      <div className="glass rounded-2xl p-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">
          {t("reviewsReceived")} ({reviews.length})
        </h3>
        <ReviewList reviews={reviews} isOwner />
      </div>
    </div>
  );
}

function XPRow({ label, value, detail, bold }: { label: string; value: number; detail?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className={`text-sm ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}>
          {label}
        </span>
        {detail && (
          <span className="ml-2 text-xs text-muted-foreground/70">({detail})</span>
        )}
      </div>
      <span className={`font-mono ${bold ? "text-lg font-bold text-primary" : "text-sm font-semibold text-foreground"}`}>
        {value} XP
      </span>
    </div>
  );
}
