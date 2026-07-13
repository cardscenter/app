import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  CalendarDays,
  TrendingUp,
  ShoppingBag,
  Star,
  MessageSquare,
  PackageCheck,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { getSellerStats } from "@/actions/review";
import { getUserAchievements } from "@/lib/achievements";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/seller-levels";
import { LevelTrack } from "@/components/dashboard/level/level-track";
import { ReputationTabs } from "@/components/dashboard/cluster-tabs";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";

/**
 * Level & XP-pagina (volledig vernieuwd in Fase 44): gradient-hero in
 * level-kleur, horizontale 14-tier voortgangstrack, XP-bronnen als kaarten
 * met verdien-tips, volgend-level-preview en een achievements-teaser
 * (bonus-XP blijft zichtbaar terwijl de cosmetics-hub op slot is).
 */
export default async function DashboardLevelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("reputation");

  const [stats, achievements] = await Promise.all([
    getSellerStats(session.user.id),
    getUserAchievements(session.user.id),
  ]);
  if (!stats) return null;

  const currentLevel = getLevel(stats.xp);
  const nextLevel = getNextLevel(stats.xp);
  const progress = getLevelProgress(stats.xp);

  type XpSource = {
    key: string;
    icon: LucideIcon;
    label: string;
    value: number;
    rate: string;
    tip: string;
    ctaHref?: string;
    ctaLabel?: string;
  };

  const xpSources: XpSource[] = [
    {
      key: "accountAge",
      icon: CalendarDays,
      label: t("xpAccountAge"),
      value: stats.xpBreakdown.accountAge,
      rate: t("xpDetailAccountAge"),
      tip: t("xpTipAccountAge"),
    },
    {
      key: "sales",
      icon: TrendingUp,
      label: t("xpSales"),
      value: stats.xpBreakdown.sales,
      rate: t("xpDetailSales"),
      tip: t("xpTipSales"),
      ctaHref: "/marktplaats/nieuw",
      ctaLabel: t("xpTipSalesCta"),
    },
    {
      key: "purchases",
      icon: ShoppingBag,
      label: t("xpPurchases"),
      value: stats.xpBreakdown.purchases,
      rate: t("xpDetailPurchases"),
      tip: t("xpTipPurchases"),
      ctaHref: "/marktplaats",
      ctaLabel: t("xpTipPurchasesCta"),
    },
    {
      key: "positiveReviews",
      icon: Star,
      label: t("xpReviews"),
      value: stats.xpBreakdown.positiveReviews,
      rate: t("xpDetailReviews"),
      tip: t("xpTipReviews"),
    },
    {
      key: "reviewsGiven",
      icon: MessageSquare,
      label: t("xpReviewsGiven"),
      value: stats.xpBreakdown.reviewsGiven,
      rate: t("xpDetailReviewsGiven"),
      tip: t("xpTipReviewsGiven"),
      ctaHref: "/dashboard/aankopen",
      ctaLabel: t("xpTipReviewsGivenCta"),
    },
    {
      key: "transactions",
      icon: PackageCheck,
      label: t("xpTransactions"),
      value: stats.xpBreakdown.completedTransactions,
      rate: t("xpDetailTransactions"),
      tip: t("xpTipTransactions"),
    },
  ];

  // Achievements met XP-beloning op de volgende tier, gesorteerd op
  // "bijna binnen" — dat is de meest motiverende volgorde.
  const xpAchievements = achievements
    .filter((a) => a.nextTier?.rewardXP)
    .sort((a, b) => b.nextTierProgressPercent - a.nextTierProgressPercent)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <ReputationTabs />

      {/* Gradient-hero in level-kleur */}
      <div className="relative overflow-hidden rounded-2xl border border-border shadow-card">
        <div className={`relative bg-gradient-to-br ${currentLevel.gradient} px-6 py-8 text-white`}>
          <span
            className="pointer-events-none absolute -right-6 -top-10 select-none text-[9rem] opacity-15"
            aria-hidden
          >
            {currentLevel.icon}
          </span>
          <div className="relative flex flex-wrap items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-4xl backdrop-blur-sm">
              {currentLevel.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/80">{t("currentLevel")}</p>
              <h2 className="text-3xl font-bold">{currentLevel.name}</h2>
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {stats.xp.toLocaleString("nl-NL")} XP
            </p>
          </div>
        </div>

        <div className="bg-card p-6">
          {nextLevel ? (
            <>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {currentLevel.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {currentLevel.minXP.toLocaleString("nl-NL")} XP
                  </span>
                </span>
                <span className="font-medium text-foreground">
                  {nextLevel.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {nextLevel.minXP.toLocaleString("nl-NL")} XP
                  </span>
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${nextLevel.gradient} transition-all duration-500`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("xpToNextLevel", { xp: nextLevel.minXP - stats.xp, level: nextLevel.name })}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-primary">{t("maxLevelReached")}</p>
          )}
        </div>
      </div>

      {/* Level-track — alle 14 tiers als horizontale tijdlijn */}
      <DashboardSection title={t("levelProgression")} contentClassName="p-0">
        <LevelTrack xp={stats.xp} youAreHereLabel={t("youAreHere")} />
      </DashboardSection>

      {/* XP-bronnen als kaarten */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("xpSourcesTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {xpSources.map((source) => {
            const Icon = source.icon;
            return (
              <div
                key={source.key}
                className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{source.label}</p>
                    <p className="text-xs text-muted-foreground">{source.rate}</p>
                  </div>
                </div>
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-foreground">
                  {source.value.toLocaleString("nl-NL")} XP
                </p>
                <p className="mt-2 flex-1 text-xs text-muted-foreground">{source.tip}</p>
                {source.ctaHref && source.ctaLabel && (
                  <Link
                    href={source.ctaHref}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    {source.ctaLabel} →
                  </Link>
                )}
              </div>
            );
          })}

          {stats.xpBreakdown.bonus > 0 && (
            <div className="flex flex-col rounded-2xl border border-amber-500/25 bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{t("bonusXpTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("bonusXpVia")}</p>
                </div>
              </div>
              <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-foreground">
                {stats.xpBreakdown.bonus.toLocaleString("nl-NL")} XP
              </p>
            </div>
          )}
        </div>

        {/* Totaalstrip */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <span className="text-sm font-semibold text-foreground">{t("xpTotal")}</span>
          <span className="font-mono text-lg font-bold tabular-nums text-primary">
            {stats.xp.toLocaleString("nl-NL")} XP
          </span>
        </div>
      </section>

      {/* Volgend-level-preview: de banner-beloning */}
      {nextLevel && (
        <DashboardSection
          title={t("nextLevelTitle", { level: nextLevel.name })}
          description={t("xpToNextLevel", { xp: nextLevel.minXP - stats.xp, level: nextLevel.name })}
        >
          <div
            className={`flex h-20 items-center gap-3 rounded-xl bg-gradient-to-br ${nextLevel.gradient} px-5 text-white`}
          >
            <span className="text-3xl">{nextLevel.icon}</span>
            <span className="text-lg font-bold">{nextLevel.name}</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("nextLevelUnlocks", { name: nextLevel.name })}
          </p>
        </DashboardSection>
      )}

      {/* Achievements-teaser: bonus-XP blijft zichtbaar ondanks de
          personalisatie-lockdown (geen link naar /customization). */}
      <DashboardSection
        icon={<Trophy className="size-5" />}
        title={t("achievementsTitle")}
        description={t("achievementsDesc")}
      >
        {xpAchievements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("achievementsAllDone")}</p>
        ) : (
          <div className="space-y-4">
            {xpAchievements.map((a) => (
              <div key={a.key}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{a.name}</p>
                  <StatusBadge tone="primary">+{a.nextTier?.rewardXP} XP</StatusBadge>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${a.nextTierProgressPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  {a.progress.toLocaleString("nl-NL")} / {a.nextTier?.threshold.toLocaleString("nl-NL")}
                </p>
              </div>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
