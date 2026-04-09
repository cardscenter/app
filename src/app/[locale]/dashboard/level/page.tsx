import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSellerStats } from "@/actions/review";
import { getLevel, getNextLevel, getLevelProgress, SELLER_LEVELS } from "@/lib/seller-levels";

export default async function DashboardLevelPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("reputation");
  const td = await getTranslations("dashboard");
  const stats = await getSellerStats(session.user.id);

  if (!stats) return null;

  const currentLevel = getLevel(stats.xp);
  const nextLevel = getNextLevel(stats.xp);
  const progress = getLevelProgress(stats.xp);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{td("myLevel")}</h1>

      {/* Current level hero */}
      <div className={`glass rounded-2xl p-6 border ${currentLevel.borderColor}`}>
        <div className="flex items-center gap-4">
          <div className="text-4xl">{currentLevel.icon}</div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{t("currentLevel")}</p>
            <h2 className={`text-2xl font-bold ${currentLevel.color}`}>
              {currentLevel.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {stats.xp} XP
            </p>
          </div>
        </div>

        {/* Progress bar to next level */}
        {nextLevel && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{currentLevel.name}</span>
              <span className="text-muted-foreground">{nextLevel.name}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("xpToNextLevel", { xp: nextLevel.minXP - stats.xp, level: nextLevel.name })}
            </p>
          </div>
        )}

        {!nextLevel && (
          <p className="mt-4 text-sm font-medium text-primary">{t("maxLevelReached")}</p>
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
          <XPRow label={t("xpReviewsGiven")} value={stats.xpBreakdown.reviewsGiven} detail={t("xpDetailReviewsGiven")} />
          <XPRow label={t("xpTransactions")} value={stats.xpBreakdown.completedTransactions} detail={t("xpDetailTransactions")} />
          <div className="border-t border-white/10 pt-3">
            <XPRow label={t("xpTotal")} value={stats.xp} bold />
          </div>
        </div>
      </div>

      {/* All levels overview */}
      <div className="glass rounded-2xl p-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">{t("levelProgression")}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {SELLER_LEVELS.map((level) => {
            const isActive = level.nameKey === currentLevel.nameKey;
            const isUnlocked = stats.xp >= level.minXP;
            return (
              <div
                key={level.nameKey}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                  isActive
                    ? `${level.bgColor} ${level.borderColor} ${level.color} ring-2 ring-primary/30`
                    : isUnlocked
                      ? `${level.bgColor} ${level.borderColor} ${level.color}`
                      : "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-600"
                }`}
              >
                <span className={!isUnlocked ? "grayscale" : ""}>{level.icon}</span>
                <div className="min-w-0">
                  <p className="font-medium truncate">{level.name}</p>
                  <p className="text-[10px] opacity-70">{level.minXP} XP</p>
                </div>
              </div>
            );
          })}
        </div>
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
