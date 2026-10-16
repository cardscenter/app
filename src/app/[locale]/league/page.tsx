import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Trophy, Award, Stamp, Info } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/layout/page-container";
import { ensureLeagueDefaults, getActiveSeason, getStandings } from "@/lib/community/league";
import { getHubSettings } from "@/lib/app-config";
import { BADGE_CRITERION_LABEL, type BadgeCriterion } from "@/lib/community/config";
import { formatEventDateShort } from "@/lib/shop-events/format";
import { StandingsTable } from "@/components/community/standings-table";
import { LeagueBadgePill } from "@/components/community/league-badge-pill";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  return { title: `${t("leagueTitle")} | Cards Center`, description: t("leagueMeta") };
}

/** Publieke league-pagina: ranglijst van het actieve seizoen + badges + uitleg. */
export default async function LeaguePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community");
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  await ensureLeagueDefaults();
  const [season, badges, settings, closed] = await Promise.all([
    getActiveSeason(),
    prisma.leagueBadge.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }),
    getHubSettings(),
    prisma.leagueSeason.findMany({ where: { status: "CLOSED" }, orderBy: { endsAt: "desc" }, take: 3, select: { id: true, name: true, endsAt: true } }),
  ]);
  const standings = season ? await getStandings(season.id, viewerId) : [];
  const viewerOnList = standings.some((s) => s.isViewer);

  return (
    <PageContainer width="default" className="py-8 sm:py-10">
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Trophy className="size-3.5" /> Cards Center Hulst
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("leagueTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("leagueIntro")}</p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="dash-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-[15px] font-semibold">{season ? t("seasonStandings", { name: season.name }) : t("noSeasonTitle")}</h2>
              {season && (
                <span className="text-xs text-muted-foreground">
                  {formatEventDateShort(season.startsAt, locale)} – {formatEventDateShort(season.endsAt, locale)}
                </span>
              )}
            </div>
            {!season ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("noSeasonBody")}</p>
            ) : standings.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("noResultsYet")}</p>
            ) : (
              <StandingsTable rows={standings} />
            )}
            {season && (
              <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                {t("pointsRule", { win: season.pointsWin, draw: season.pointsDraw, loss: season.pointsLoss, part: season.pointsParticipation })}
              </p>
            )}
          </section>

          {viewerId && season && !viewerOnList && (
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Info className="mr-1.5 inline size-4 align-text-bottom" />
              {t("notOnListHint")}
            </p>
          )}

          {closed.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("previousSeasons")}: {closed.map((s) => s.name).join(", ")}
            </p>
          )}
        </div>

        <aside className="space-y-6">
          <section className="dash-card p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <Award className="size-4 text-amber-500" /> {t("badgesTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("badgesIntro")}</p>
            <ul className="mt-4 space-y-3">
              {badges.map((b) => (
                <li key={b.id} className="flex items-start gap-3">
                  <LeagueBadgePill name={b.name} color={b.color} size="sm" />
                  <div className="min-w-0 text-sm">
                    <p>{b.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {BADGE_CRITERION_LABEL[b.criterion as BadgeCriterion]}: {b.threshold}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="dash-card p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <Stamp className="size-4 text-amber-500" /> {t("stampCardTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("stampCardIntro", { per: settings.stampsPerCard })}</p>
            <p className="mt-2 text-sm">{settings.stampReward}</p>
            {settings.pointsPerCheckIn > 0 && <p className="mt-2 text-sm text-muted-foreground">{t("pointsIntro", { points: settings.pointsPerCheckIn })}</p>}
            <Link href={viewerId ? "/dashboard/league" : "/login?callbackUrl=/dashboard/league"} className="mt-4 inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
              {viewerId ? t("viewMyCard") : t("loginToSee")}
            </Link>
          </section>

          <section className="dash-card p-5 text-sm">
            <h2 className="text-[15px] font-semibold">{t("howTitle")}</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>{t("how1")}</li>
              <li>{t("how2")}</li>
              <li>{t("how3")}</li>
              <li>{t("how4")}</li>
            </ol>
            <Link href="/evenementen" className="mt-3 inline-block font-medium text-primary hover:underline">
              {t("toEvents")}
            </Link>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
