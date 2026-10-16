import { getTranslations } from "next-intl/server";
import { getLandingData } from "@/lib/landing-data";
import { formatEventDateShort, formatEventTime, formatPrice } from "@/lib/shop-events/format";
import { PLATFORM, formatShopAddress } from "@/lib/platform-config";
import { LandingHero } from "./hero";
import { Marquee } from "@/components/ploy/marquee";
import { Pillars } from "./pillars";
import { StatsPanel, type StatCardData } from "./stats-panel";
import { ActivityPanel, type ActivityItem } from "./activity-panel";
import { EventsPanel, type EventCardData } from "./events-panel";
import { PlatformSection } from "./platform-section";
import { AudienceAccordion } from "@/components/ploy/audience-accordion";
import { CtaSection } from "./cta-section";
import { LandingFooter } from "./landing-footer";

const TZ = "Europe/Amsterdam";

/** Event-type kleuren zijn namen (zie `EVENT_TYPE_COLORS`); de pil op de kaart wil een hex. */
const TYPE_HEX: Record<string, string> = {
  blue: "#2563eb",
  amber: "#f59e0b",
  violet: "#7c3aed",
  emerald: "#059669",
  rose: "#e11d48",
  sky: "#0284c7",
  orange: "#ea580c",
  pink: "#db2777",
  teal: "#0d9488",
  indigo: "#4f46e5",
  slate: "#475569",
};
const typeHex = (c: string | null | undefined) => (c && c.startsWith("#") ? c : TYPE_HEX[c ?? ""] ?? "#8c1420");

function datePart(d: Date, locale: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nl-NL", { timeZone: TZ, ...opts }).format(d);
}

/**
 * Nieuwe homepage van de Community Hub (design-pass 2026-10, naar de
 * Ploy-referentie): eigen pil-navigatie, donkere hero met ballonnen,
 * gekleurde panelen met echte data (events, nieuws, league, spaarkaart) en
 * een eigen donkere footer. De site-header en -footer worden hier verborgen;
 * de vorige homepage staat ongewijzigd in `hub-homepage.tsx` (HOMEPAGE_LEGACY=true).
 */
export async function LandingPage({ locale, viewer }: { locale: string; viewer: { id: string; name: string; image: string | null } | null }) {
  const [t, data] = await Promise.all([getTranslations("home.landing"), getLandingData(viewer?.id ?? null)]);
  const { events, news, games, season, standings, settings, counts } = data;
  const year = new Date().getFullYear();
  const address = formatShopAddress();
  const leader = standings[0] ?? null;
  const nextEvent = events[0] ?? null;

  // Hero: laatste nieuwsbericht als aankondiging linksonder.
  const latest = news[0] ?? null;
  const announcement = latest ? { kicker: t("announcementKicker"), title: latest.title, href: `/nieuws/${latest.slug}`, image: latest.coverImage } : null;

  // Loopband: spellen + wat de winkel biedt.
  const marqueeItems = [...games.map((g) => g.name), t("marqueeTables"), t("marqueeBar"), t("marqueeLeague"), t("marqueeBuyback")];

  // Cijferkaarten (echte tellingen; de lijntjes zijn sfeer).
  const thisMonth = events.filter((e) => new Date(e.startsAt).getMonth() === new Date().getMonth()).length;
  const statCards: StatCardData[] = [
    {
      badge: t("statsEventsBadge"),
      color: "pink",
      value: counts.upcomingEvents,
      label: t("statsEventsLabel"),
      feed: nextEvent ? t("statsEventsFeed", { title: nextEvent.title, date: formatEventDateShort(new Date(nextEvent.startsAt), locale) }) : t("statsEventsFeedEmpty"),
      stats: [
        { label: t("statsEventsStat1"), value: String(games.length) },
        { label: t("statsEventsStat2"), value: "14" },
        { label: t("statsEventsStat3"), value: String(thisMonth) },
      ],
      status: t("statsEventsStatus"),
    },
    {
      badge: t("statsLeagueBadge"),
      color: "green",
      value: counts.seasonPlayers,
      label: t("statsLeagueLabel"),
      feed: leader && season ? t("statsLeagueFeed", { name: leader.displayName, points: leader.points, season: season.name }) : t("statsLeagueFeedEmpty"),
      stats: [
        { label: t("statsLeagueStat1"), value: String(counts.seasonResults) },
        { label: t("statsLeagueStat2"), value: leader ? String(leader.points) : "0" },
        { label: t("statsLeagueStat3"), value: String(counts.members) },
      ],
      status: t("statsLeagueStatus"),
    },
    {
      badge: t("statsLoyaltyBadge"),
      color: "yellow",
      value: settings.stampsPerCard,
      label: t("statsLoyaltyLabel"),
      feed: settings.stampReward ? t("statsLoyaltyFeed", { reward: settings.stampReward }) : t("statsLoyaltyFeedEmpty"),
      stats: [
        { label: t("statsLoyaltyStat1"), value: String(settings.pointsPerCheckIn) },
        { label: t("statsLoyaltyStat2"), value: String(settings.pointsPerFullCard) },
        { label: t("statsLoyaltyStat3"), value: "1" },
      ],
      status: t("statsLoyaltyStatus"),
    },
  ];

  // Activiteitenfeed: nieuws, events, league-stand en een paar vaste kaarten.
  const feed: ActivityItem[] = [
    ...news.slice(0, 3).map((n) => ({
      id: `news-${n.id}`,
      time: n.publishedAt ? formatEventDateShort(new Date(n.publishedAt), locale) : "",
      badge: t("badgeNews"),
      color: "pink" as const,
      title: n.title,
      description: n.excerpt ?? t("activityNewsDesc"),
      href: `/nieuws/${n.slug}`,
    })),
    ...events.slice(0, 3).map((e) => ({
      id: `event-${e.id}`,
      time: formatEventDateShort(new Date(e.startsAt), locale),
      badge: t("badgeEvent"),
      color: "blue" as const,
      title: e.title,
      description: `${e.typeName}${e.gameName ? ` · ${e.gameName}` : ""} · ${formatPrice(e.price, locale)}`,
      href: `/evenementen/${e.id}`,
    })),
    ...standings.slice(0, 3).map((s) => ({
      id: `rank-${s.userId}`,
      time: season?.name ?? "",
      badge: t("badgeLeague"),
      color: "green" as const,
      title: t("activityRankTitle", { name: s.displayName, rank: s.rank }),
      description: t("activityRankDesc", { points: s.points }),
      href: "/league",
    })),
    { id: "static-open", time: PLATFORM.shop.city, badge: t("badgeInfo"), color: "yellow" as const, title: t("activityOpeningTitle"), description: t("activityOpeningDesc"), href: "/info" },
    { id: "static-stamps", time: t("activityNow"), badge: t("badgeInfo"), color: "yellow" as const, title: t("activityStampsTitle", { n: settings.stampsPerCard }), description: t("activityStampsDesc"), href: "/dashboard/league" },
    { id: "static-order", time: t("activityNow"), badge: t("badgeInfo"), color: "yellow" as const, title: t("activityOrderTitle"), description: t("activityOrderDesc"), href: "/bestellen?modus=bar" },
  ];

  // Event-kaarten.
  const eventCards: EventCardData[] = events.slice(0, 8).map((e) => {
    const d = new Date(e.startsAt);
    const spots = e.availability.spotsLeft;
    const meta = e.availability.full ? t("eventsMetaFull") : spots === null ? t("eventsMetaUnlimited") : t("eventsMetaSpots", { n: spots });
    return {
      id: e.id,
      href: `/evenementen/${e.id}`,
      weekday: datePart(d, locale, { weekday: "long" }),
      day: datePart(d, locale, { day: "numeric" }),
      month: datePart(d, locale, { month: "long" }),
      time: formatEventTime(d, locale),
      title: e.title,
      type: e.typeName,
      typeColor: typeHex(e.typeColor),
      price: formatPrice(e.price, locale),
      meta: `${e.gameName ? `${e.gameName} · ` : ""}${meta}`,
    };
  });

  return (
    <div className="cc-landing overflow-clip" style={{ colorScheme: "light" }}>
      {/* De oude site-footer (en zijn ZDivider-strook) verdwijnt in Fase A5; tot dan hier verborgen. */}
      <style>{`body > footer, main + div { display: none !important; }`}</style>
      <LandingHero
        eyebrow={t("heroEyebrow", { address })}
        title={viewer ? t("heroTitleLoggedIn", { name: viewer.name.split(" ")[0] ?? viewer.name }) : t("heroTitle")}
        subtitle={t("heroSubtitle")}
        loggedIn={!!viewer}
        announcement={announcement}
      />
      <Marquee intro={t("marqueeIntro")} items={marqueeItems} />
      <Pillars
        title={t("pillarsTitle")}
        description={t("pillarsDesc")}
        items={[
          { title: t("pillarPlayTitle"), text: t("pillarPlayText"), href: "/evenementen", linkLabel: t("pillarPlayLink"), color: "pink", animation: "helix" },
          { title: t("pillarEatTitle"), text: t("pillarEatText"), href: "/bestellen?modus=bar", linkLabel: t("pillarEatLink"), color: "yellow", animation: "waves" },
          { title: t("pillarCollectTitle"), text: t("pillarCollectText"), href: "/kaarten", linkLabel: t("pillarCollectLink"), color: "blue", animation: "rain" },
        ]}
      />
      <StatsPanel titleLine1={t("statsTitle1")} titleLine2={t("statsTitle2")} description={t("statsDesc")} cards={statCards} color="pink" balloon="red" />
      <ActivityPanel titleTop={t("activityTop")} titleBottom={t("activityBottom")} items={feed} />
      <EventsPanel
        titleParts={[t("eventsTitle1"), `${t("eventsTitle2")} ${t("eventsTitle3")}`]}
        highlightWord={PLATFORM.shop.city}
        illustration={{ src: "/images/sections/basiliek.webp" }}
        description={t("eventsDesc")}
        events={eventCards}
        cardCta={t("eventsCardCta")}
        emptyTitle={t("eventsEmptyTitle")}
        emptyText={t("eventsEmptyText")}
        allLabel={t("eventsAll")}
      />
      <PlatformSection
        words={[t("platformWord1"), t("platformWord2"), t("platformWord3"), t("platformWord4")]}
        columns={[
          { badge: t("colTicketsBadge"), color: "pink", title: t("colTicketsTitle"), bullets: [t("colTicketsB1"), t("colTicketsB2"), t("colTicketsB3")] },
          { badge: t("colFoodBadge"), color: "yellow", title: t("colFoodTitle"), bullets: [t("colFoodB1"), t("colFoodB2"), t("colFoodB3")] },
          { badge: t("colLoyaltyBadge"), color: "green", title: t("colLoyaltyTitle"), bullets: [t("colLoyaltyB1"), t("colLoyaltyB2"), t("colLoyaltyB3")] },
        ]}
      />
      <AudienceAccordion
        eyebrow={t("audienceEyebrow")}
        title={t("audienceTitle")}
        items={[
          { title: t("audPlayersTitle"), description: t("audPlayersDesc"), color: "blue", bullets: [t("audPlayersB1"), t("audPlayersB2"), t("audPlayersB3"), t("audPlayersB4")], ctaLabel: t("audPlayersCta"), ctaHref: "/evenementen" },
          { title: t("audParentsTitle"), description: t("audParentsDesc"), color: "yellow", bullets: [t("audParentsB1"), t("audParentsB2"), t("audParentsB3"), t("audParentsB4")], ctaLabel: t("audParentsCta"), ctaHref: "/info" },
          { title: t("audCollectorsTitle"), description: t("audCollectorsDesc"), color: "pink", bullets: [t("audCollectorsB1"), t("audCollectorsB2"), t("audCollectorsB3"), t("audCollectorsB4")], ctaLabel: t("audCollectorsCta"), ctaHref: "/verkopen" },
        ]}
      />
      <CtaSection
        title={t("ctaTitle")}
        description={t("ctaDesc")}
        placeholder={t("ctaPlaceholder")}
        buttonLabel={t("ctaButton")}
        reassurance={t("ctaReassurance")}
        loggedIn={!!viewer}
        dashboardLabel={t("ctaDashboard")}
      />
      <LandingFooter
        tagline={t("footerTagline", { address })}
        contactLabel={PLATFORM.supportEmail}
        contactHref={`mailto:${PLATFORM.supportEmail}`}
        columns={[
          {
            title: t("colShop"),
            links: [
              { label: t("linkEvents"), href: "/evenementen" },
              { label: t("linkOrder"), href: "/bestellen?modus=bar" },
              { label: t("linkSell"), href: "/verkopen" },
              { label: t("linkInfo"), href: "/info" },
            ],
          },
          {
            title: t("colCommunity"),
            links: [
              { label: t("linkLeague"), href: "/league" },
              { label: t("linkNews"), href: "/nieuws" },
              { label: t("linkCards"), href: "/kaarten" },
            ],
          },
          {
            title: t("colAccount"),
            links: viewer
              ? [
                  { label: t("linkDashboard"), href: "/dashboard" },
                  { label: t("linkTickets"), href: "/dashboard/tickets" },
                  { label: t("linkMyLeague"), href: "/dashboard/league" },
                ]
              : [
                  { label: t("linkLogin"), href: "/login" },
                  { label: t("linkRegister"), href: "/register" },
                ],
          },
          {
            title: t("colAbout"),
            links: [
              { label: t("linkSupport"), href: "/support" },
              { label: t("linkPrivacy"), href: "/privacy" },
              { label: t("linkTerms"), href: "/voorwaarden" },
            ],
          },
        ]}
        legal={[
          { label: t("linkPrivacy"), href: "/privacy" },
          { label: t("linkTerms"), href: "/voorwaarden" },
        ]}
        copyright={t("copyright", { year })}
      />
    </div>
  );
}
