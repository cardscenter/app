import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Trophy, Stamp, Coins, Award, History } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getUserLeagueSummary } from "@/lib/community/league";
import { getLoyaltySummary } from "@/lib/community/loyalty";
import { formatEventDateShort } from "@/lib/shop-events/format";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatCard } from "@/components/dashboard/ui/stat-card";
import { StampCardVisual } from "@/components/community/stamp-card-visual";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { PILL_BTN, TABLE_HEAD, TABLE_CELL } from "@/components/ploy/tile-styles";
import { LeagueBadgePill } from "@/components/community/league-badge-pill";

export const dynamic = "force-dynamic";

/** Speler: eigen league-positie, stempelkaart, spaarpunten, badges en historie. */
export default async function MyLeaguePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login?callbackUrl=/dashboard/league`);
  const t = await getTranslations("community");
  const [league, loyalty] = await Promise.all([getUserLeagueSummary(session.user.id), getLoyaltySummary(session.user.id)]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("myLeague")}
        subtitle={t("myLeagueSubtitle")}
        action={
          <Link href="/league" className={PILL_BTN}>
            <Trophy className="size-4" /> {t("viewLeague")}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={league.season ? t("seasonPosition", { name: league.season.name }) : t("noSeasonTitle")}
          value={league.rank ? `#${league.rank}` : "-"}
          icon={Trophy}
          tone="blue"
          hint={league.season ? `${league.points} ${t("points").toLowerCase()} · ${league.wins}-${league.losses}-${league.draws}` : undefined}
        />
        <StatCard label={t("pointsBalance")} value={String(loyalty.points.balance)} icon={Coins} tone="green" hint={t("pointsHint")} />
        <StatCard label={t("stampCardTitle")} value={t("stampsOnCard", { n: loyalty.stamps.onCard, per: loyalty.stamps.perCard })} icon={Stamp} tone="yellow" hint={t("cardsCompleted", { count: loyalty.stamps.completedCards })} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardSection
          title={t("stampCardTitle")}
          icon={<Stamp className="size-5" />}
          tone="yellow"
          action={<span className="cc-display text-2xl tabular-nums">{loyalty.stamps.onCard}/{loyalty.stamps.perCard}</span>}
        >
          <StampCardVisual total={loyalty.stamps.perCard} filled={loyalty.stamps.onCard} seed={session.user.id} className="max-w-sm" />
          <p className="mt-4 text-sm font-semibold">{t("stampsOnCard", { n: loyalty.stamps.onCard, per: loyalty.stamps.perCard })}</p>
          <p className="mt-1 text-sm opacity-80">{t("stampsHint")}</p>
          <p className="mt-3 text-sm">
            <span className="font-semibold">{t("reward")}:</span> {loyalty.stamps.reward}
          </p>
        </DashboardSection>

        <DashboardSection title={t("myBadges")} icon={<Award className="size-5" />}>
          {league.badges.length === 0 ? (
            <EmptyState icon={Award} title={t("noBadges")} tone="blue" compact />
          ) : (
            <ul className="space-y-3">
              {league.badges.map((b) => (
                <li key={`${b.key}-${b.awardedAt}`} className="flex items-start gap-3">
                  <LeagueBadgePill name={b.name} color={b.color} />
                  <div className="text-sm">
                    <p>{b.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatEventDateShort(new Date(b.awardedAt), locale)}
                      {b.seasonName ? ` · ${b.seasonName}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection title={t("recentResults")} icon={<Trophy className="size-5" />} contentClassName="px-0 pb-3 pt-4 sm:px-0 sm:pb-3">
          {league.recentResults.length === 0 ? (
            <p className="px-5 pb-2 text-sm text-muted-foreground sm:px-6">{league.season ? t("noPositionYet") : t("noResults")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className={`${TABLE_HEAD} bg-[var(--background)]`}>
                <tr>
                  <th className={TABLE_CELL}>Event</th>
                  <th className={`${TABLE_CELL} text-right`}>{t("record")}</th>
                  <th className={`${TABLE_CELL} text-right`}>{t("points")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {league.recentResults.map((r) => (
                  <tr key={r.id}>
                    <td className={TABLE_CELL}>
                      <p className="font-medium">{r.eventTitle ?? r.seasonName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatEventDateShort(new Date(r.date), locale)} · {r.seasonName}
                      </p>
                    </td>
                    <td className={`${TABLE_CELL} text-right tabular-nums`}>
                      {r.wins}-{r.losses}-{r.draws}
                    </td>
                    <td className={`${TABLE_CELL} text-right font-semibold tabular-nums`}>+{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DashboardSection>

        <DashboardSection title={t("history")} icon={<History className="size-5" />} contentClassName="px-0 pb-3 pt-4 sm:px-0 sm:pb-3">
          {loyalty.recent.length === 0 ? (
            <p className="px-5 pb-2 text-sm text-muted-foreground sm:px-6">{t("noHistory")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {loyalty.recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate">{e.reason}</p>
                    <p className="text-xs text-muted-foreground">{formatEventDateShort(new Date(e.createdAt), locale)}</p>
                  </div>
                  <StatusBadge tone={e.delta < 0 ? "danger" : e.kind === "STAMP" ? "warning" : "success"}>
                    {e.delta > 0 ? "+" : ""}
                    {e.delta} {e.kind === "STAMP" ? (Math.abs(e.delta) === 1 ? "stempel" : "stempels") : "pt"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>
      </div>
    </div>
  );
}
