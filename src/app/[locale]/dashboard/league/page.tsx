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
import { StampCard } from "@/components/community/stamp-card";
import { LeagueBadgePill } from "@/components/community/league-badge-pill";

export const dynamic = "force-dynamic";

const BTN_OUTLINE = "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted";

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
          <Link href="/league" className={BTN_OUTLINE}>
            <Trophy className="size-4" /> {t("viewLeague")}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={league.season ? t("seasonPosition", { name: league.season.name }) : t("noSeasonTitle")}
          value={league.rank ? `#${league.rank}` : "–"}
          icon={Trophy}
          iconClassName="bg-amber-500/10 text-amber-600"
          hint={league.season ? `${league.points} ${t("points").toLowerCase()} · ${league.wins}-${league.losses}-${league.draws}` : undefined}
        />
        <StatCard label={t("pointsBalance")} value={String(loyalty.points.balance)} icon={Coins} iconClassName="bg-emerald-500/10 text-emerald-600" hint={t("pointsHint")} />
        <StatCard label={t("stampCardTitle")} value={t("stampsOnCard", { n: loyalty.stamps.onCard, per: loyalty.stamps.perCard })} icon={Stamp} iconClassName="bg-amber-500/10 text-amber-600" hint={t("cardsCompleted", { count: loyalty.stamps.completedCards })} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardSection title={t("stampCardTitle")} icon={<Stamp className="size-5" />}>
          <StampCard onCard={loyalty.stamps.onCard} perCard={loyalty.stamps.perCard} label={t("stampsOnCard", { n: loyalty.stamps.onCard, per: loyalty.stamps.perCard })} />
          <p className="mt-3 text-sm text-muted-foreground">{t("stampsHint")}</p>
          <p className="mt-2 text-sm">
            <span className="font-semibold">{t("reward")}:</span> {loyalty.stamps.reward}
          </p>
        </DashboardSection>

        <DashboardSection title={t("myBadges")} icon={<Award className="size-5" />}>
          {league.badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noBadges")}</p>
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

        <DashboardSection title={t("recentResults")} icon={<Trophy className="size-5" />} contentClassName="p-0">
          {league.recentResults.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">{league.season ? t("noPositionYet") : t("noResults")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Event</th>
                  <th className="px-4 py-2 text-right">{t("record")}</th>
                  <th className="px-4 py-2 text-right">{t("points")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {league.recentResults.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      <p className="font-medium">{r.eventTitle ?? r.seasonName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatEventDateShort(new Date(r.date), locale)} · {r.seasonName}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.wins}-{r.losses}-{r.draws}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">+{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DashboardSection>

        <DashboardSection title={t("history")} icon={<History className="size-5" />} contentClassName="p-0">
          {loyalty.recent.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">{t("noHistory")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {loyalty.recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{e.reason}</p>
                    <p className="text-xs text-muted-foreground">{formatEventDateShort(new Date(e.createdAt), locale)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${e.delta < 0 ? "bg-rose-500/10 text-rose-600" : e.kind === "STAMP" ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                    {e.delta > 0 ? "+" : ""}
                    {e.delta} {e.kind === "STAMP" ? (Math.abs(e.delta) === 1 ? "stempel" : "stempels") : "pt"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>
      </div>
    </div>
  );
}
