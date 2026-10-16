import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureLeagueDefaults, getActiveSeason, getStandings } from "@/lib/community/league";
import { getHubSettings } from "@/lib/app-config";
import { BADGE_CRITERION_LABEL, LOYALTY_DEFAULTS, type BadgeCriterion } from "@/lib/community/config";
import { formatEventDateShort } from "@/lib/shop-events/format";
import { typePastel } from "@/components/shop-events/event-type-pill";
import { CenteredHero } from "@/components/ploy/centered-hero";
import { CtaButton } from "@/components/ploy/cta-button";
import { SectionHead } from "@/components/ploy/section-head";
import { DataCard } from "@/components/ploy/data-card";
import { PunchCard } from "@/components/ploy/punch-card";
import { Panel } from "@/components/ploy/panel";
import { Pill } from "@/components/ploy/pill";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { PhaseLadder } from "@/components/ploy/phase-ladder";
import { TileQuad, type TileItem } from "@/components/ploy/tile-quad";
import { FeatureRows } from "@/components/ploy/feature-rows";
import { ClosingCta } from "@/components/ploy/closing-cta";
import { Balloon } from "@/components/ploy/balloon";
import { StandingsTable } from "@/components/community/standings-table";
import { Podium } from "@/components/community/podium";
import { StampCardVisual } from "@/components/community/stamp-card-visual";

export const dynamic = "force-dynamic";

const ANIMATIONS = ["helix", "rain", "waves", "scan", "pulse"] as const;
const TILE_COLORS: Array<TileItem["color"]> = ["green", "blue", "yellow", "pink", "ink"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  return { title: `${t("leagueTitle")} | Cards Center`, description: t("leagueMeta") };
}

/**
 * Publieke league-pagina (design-pass Fase C): hero met veegstreep, podium +
 * ranglijst in een datakaart, puntenladder, de poorten van Hulst als tegels,
 * de stempelkaart in een geel paneel, "zo werkt het" als rijen en een slotpaneel.
 */
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
  const [standings, seasonEvents, seasonResults] = season
    ? await Promise.all([
        getStandings(season.id, viewerId),
        prisma.leagueResult.findMany({ where: { seasonId: season.id, eventId: { not: null } }, distinct: ["eventId"], select: { eventId: true } }),
        prisma.leagueResult.count({ where: { seasonId: season.id } }),
      ])
    : [[], [], 0];
  const viewerOnList = standings.some((s) => s.isViewer);
  const leader = standings[0] ?? null;
  const rules = season ?? { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, pointsParticipation: 1 };
  const myCardHref = viewerId ? "/dashboard/league" : "/login?callbackUrl=/dashboard/league";
  const stampsPerCard = settings.stampsPerCard || LOYALTY_DEFAULTS.stampsPerCard;
  const demoFilled = Math.max(1, Math.round(stampsPerCard * 0.6));

  const badgeTiles: TileItem[] = badges.map((b, i) => ({
    title: b.name,
    color: TILE_COLORS[i % TILE_COLORS.length]!,
    animation: ANIMATIONS[i % ANIMATIONS.length],
    text: (
      <>
        <p>{b.description}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] opacity-70">
          {BADGE_CRITERION_LABEL[b.criterion as BadgeCriterion]}: {b.threshold}
        </p>
      </>
    ),
    action: <Pill tone="pastel" color={typePastel(b.color)}>{t("badgeTileLabel", { n: i + 1 })}</Pill>,
  }));

  return (
    <div className="cc-landing overflow-clip">
      <CenteredHero
        title={t("leagueHeroTitle")}
        highlightWord={t("leagueHeroWord")}
        highlightColor="green"
        description={t("leagueIntro")}
      >
        <CtaButton href="/evenementen" variant="red">
          {t("toEvents")}
        </CtaButton>
        <CtaButton href={myCardHref} variant="light">
          {viewerId ? t("viewMyCard") : t("loginToSee")}
        </CtaButton>
      </CenteredHero>

      {/* Stand */}
      <section className="flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16" id="stand">
        <div className="w-full max-w-6xl">
          <SectionHead
            eyebrow={season ? season.name : t("noSeasonTitle")}
            eyebrowColor="yellow"
            title={t("standingsTitle")}
            intro={season ? t("standingsIntro", { from: formatEventDateShort(season.startsAt, locale), to: formatEventDateShort(season.endsAt, locale) }) : t("noSeasonBody")}
          />
          {season && standings.length > 0 ? (
            <>
              <Podium rows={standings} pointsLabel={t("points").toLowerCase()} eventsLabel={t("eventsPlayed").toLowerCase()} youLabel={t("you")} />
              <DataCard
                className="mt-4"
                badge={t("seasonStandings", { name: season.name })}
                badgeColor="green"
                columns={4}
                tiles={[
                  { label: t("tilePlayers"), value: String(standings.length) },
                  { label: t("tileEvents"), value: String(seasonEvents.length) },
                  { label: t("tileResults"), value: String(seasonResults) },
                  { label: t("tileLeader"), value: leader ? leader.displayName : t("tileLeaderNone"), hint: leader ? `${leader.points} ${t("points").toLowerCase()}` : undefined },
                ]}
              >
                <StandingsTable rows={standings} />
                <p className="mt-4 text-xs text-[var(--foreground)]/55">{t("pointsRule", { win: rules.pointsWin, draw: rules.pointsDraw, loss: rules.pointsLoss, part: rules.pointsParticipation })}</p>
              </DataCard>
            </>
          ) : (
            <PunchCard className="relative overflow-hidden bg-white px-6 py-14 text-center sm:px-12" dot="var(--border)">
              <Balloon color="green" shape="flower" className="pointer-events-none absolute -right-8 -top-8 w-36 opacity-90" />
              <div className="relative mx-auto max-w-[30rem]">
                <DisplayHeading tag="h3" size={4} text={season ? t("noResultsTitle") : t("noSeasonTitle")} className="text-center" />
                <p className="cc-prose mt-3 text-base">{season ? t("noResultsYet") : t("noSeasonBody")}</p>
              </div>
            </PunchCard>
          )}
          {viewerId && season && !viewerOnList && <p className="cc-prose mt-4 text-sm">{t("notOnListHint")}</p>}
          {closed.length > 0 && (
            <p className="cc-prose mt-2 text-sm">
              {t("previousSeasons")}: {closed.map((s) => s.name).join(", ")}
            </p>
          )}
        </div>
      </section>

      <PhaseLadder
        id="punten"
        color="green"
        title={t("pointsLadderTitle")}
        intro={t("pointsLadderIntro")}
        steps={[
          { title: t("stepWin"), text: t("stepWinText", { points: rules.pointsWin }) },
          { title: t("stepDraw"), text: t("stepDrawText", { points: rules.pointsDraw }) },
          { title: t("stepLoss"), text: t("stepLossText", { points: rules.pointsLoss }) },
          { title: t("stepPart"), text: t("stepPartText", { points: rules.pointsParticipation }) },
        ]}
      />

      {/* Badges */}
      {badgeTiles.length > 0 && (
        <>
          <section className="flex justify-center px-4 pt-6 sm:px-5 lg:px-6 lg:pt-10" id="badges">
            <div className="w-full max-w-6xl">
              <SectionHead eyebrow={t("badgesTitle")} eyebrowColor="pink" title={t("badgesHeading")} intro={t("badgesIntro")} />
            </div>
          </section>
          <TileQuad items={badgeTiles} columns={3} />
        </>
      )}

      {/* Stempelkaart */}
      <Panel color="yellow" id="spaarkaart">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Pill color="yellow">{t("stampCardTitle")}</Pill>
            <DisplayHeading tag="h2" size={3} text={t("stampCardHeading", { n: stampsPerCard })} className="mt-5 max-w-[26rem]" />
            <p className="cc-prose mt-5 max-w-[28rem] text-base">{t("stampCardIntro", { per: stampsPerCard })}</p>
            {settings.stampReward && <p className="mt-3 text-base font-semibold text-[var(--foreground)]">{settings.stampReward}</p>}
            {settings.pointsPerCheckIn > 0 && <p className="cc-prose mt-2 text-sm">{t("pointsIntro", { points: settings.pointsPerCheckIn })}</p>}
            <div className="mt-7">
              <CtaButton href={myCardHref} variant="dark">
                {viewerId ? t("viewMyCard") : t("loginToSee")}
              </CtaButton>
            </div>
          </div>
          <PunchCard className="bg-white p-6 sm:p-8" dot="var(--border)">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--foreground)]">{t("stampCardSampleTitle")}</span>
              <Pill tone="pastel" color="yellow">
                {demoFilled} / {stampsPerCard}
              </Pill>
            </div>
            <StampCardVisual total={stampsPerCard} filled={demoFilled} className="mt-5" />
            <p className="cc-prose mt-5 text-sm">{t("stampCardSampleText")}</p>
          </PunchCard>
        </div>
      </Panel>

      <FeatureRows
        id="hoe"
        title={t("howTitle")}
        intro={t("howIntro")}
        rows={[
          { number: "01", text: t("how1") },
          { number: "02", text: t("how2") },
          { number: "03", text: t("how3") },
          { number: "04", text: t("how4") },
        ]}
      />

      <ClosingCta color="blue" title={t("leagueClosingTitle")} text={t("leagueClosingText")}>
        <CtaButton href="/evenementen" variant="red">
          {t("toEvents")}
        </CtaButton>
        <CtaButton href={viewerId ? "/dashboard/league" : "/register"} variant="light">
          {viewerId ? t("viewMyCard") : t("leagueClosingSecondary")}
        </CtaButton>
      </ClosingCta>
    </div>
  );
}
