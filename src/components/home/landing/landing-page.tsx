import { getTranslations } from "next-intl/server";
import { getLandingData } from "@/lib/landing-data";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { formatEventDateShort, formatEventTime, formatPrice } from "@/lib/shop-events/format";
import { PLATFORM, formatShopAddress } from "@/lib/platform-config";
import { LandingHero } from "./hero";
import { Marquee } from "@/components/ploy/marquee";
import { Pillars } from "./pillars";
import { LoyaltyPanel } from "./loyalty-panel";
import { StampCardTile, PointsTile } from "./loyalty-cards";
import { ActivityPanel, type ActivityItem } from "./activity-panel";
import { EventsPanel, type EventCardData } from "./events-panel";
import { PlatformSection } from "./platform-section";
import { AudienceAccordion } from "@/components/ploy/audience-accordion";
import { CtaSection } from "./cta-section";
import { SectionHead } from "@/components/ploy/section-head";
import { CtaButton } from "@/components/ploy/cta-button";
import { TestimonialWall, type TestimonialItem } from "@/components/ploy/testimonial-wall";

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
 * Ploy-referentie): donkere hero met ballonnen,
 * gekleurde panelen met echte data (events, nieuws, league, spaarkaart),
 * de site-brede pil-navigatie en footer. Dit is de enige homepage; bouwstenen
 * en regels staan in docs/design/DESIGN.md.
 */
export async function LandingPage({ locale, viewer }: { locale: string; viewer: { id: string; name: string; image: string | null } | null }) {
  const [t, tc, data] = await Promise.all([getTranslations("home.landing"), getTranslations("community"), getLandingData(viewer?.id ?? null)]);
  const cardDb = isFeatureEnabled("FEATURE_CARD_DATABASE");
  const { events, news, games, season, standings, settings, testimonials, loyalty } = data;
  const address = formatShopAddress();

  // Hero: laatste nieuwsbericht als aankondiging linksonder.
  const latest = news[0] ?? null;
  const announcement = latest ? { kicker: t("announcementKicker"), title: latest.title, href: `/nieuws/${latest.slug}`, image: latest.coverImage } : null;

  // Loopband: spellen + wat de winkel biedt.
  const marqueeItems = [...games.map((g) => g.name), t("marqueeTables"), t("marqueeBar"), t("marqueeLeague"), t("marqueeBuyback")];

  // Stempelkaart + spaarpunten: ingelogd de eigen kaart, uitgelogd een voorbeeld.
  const stampsFilled = loyalty ? loyalty.stamps.onCard : Math.min(3, settings.stampsPerCard);
  const stampsToGo = settings.stampsPerCard - stampsFilled;
  const earn = [
    { label: t("loyaltyEarnCheckIn"), points: settings.pointsPerCheckIn },
    { label: t("loyaltyEarnFullCard"), points: settings.pointsPerFullCard },
  ].filter((e) => e.points > 0);
  // Wat één volle kaart aan punten oplevert: het voorbeeldgetal voor gasten.
  const fullCardPoints = settings.stampsPerCard * settings.pointsPerCheckIn + settings.pointsPerFullCard;

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

  // Ervaringen-rij (design-pass Fase C): alleen vanaf drie uitgelichte quotes.
  const quotes: TestimonialItem[] = testimonials.map((r) => ({
    id: r.id,
    quote: r.quote,
    authorName: r.authorName,
    authorRole: r.authorRole,
    sourceLabel: tc(`expSource_${r.source}`),
    sourceUrl: r.sourceUrl,
    avatarUrl: r.avatarUrl,
    color: r.color,
  }));

  return (
    <div className="cc-landing overflow-clip" style={{ colorScheme: "light" }}>
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
          cardDb
            ? { title: t("pillarCollectTitle"), text: t("pillarCollectText"), href: "/kaarten", linkLabel: t("pillarCollectLink"), color: "blue", animation: "rain" }
            : { title: t("pillarCollectTitle"), text: t("pillarCollectTextSell"), href: "/verkopen/losse-kaarten", linkLabel: t("pillarCollectLinkSell"), color: "blue", animation: "rain" },
        ]}
      />
      <LoyaltyPanel
        titleLine1={t("statsTitle1")}
        titleLine2={t("statsTitle2")}
        description={t("statsDesc")}
        stampSrc="/images/sections/stempel.webp"
        action={
          <CtaButton href={viewer ? "/dashboard/league" : "/login?callbackUrl=/dashboard/league"} variant="dark">
            {viewer ? t("loyaltyCtaMember") : t("loyaltyCtaGuest")}
          </CtaButton>
        }
      >
        <StampCardTile
          badge={t("loyaltyStampBadge")}
          heading={loyalty ? t("loyaltyStampHeadingMember", { n: stampsToGo }) : t("loyaltyStampHeadingGuest", { filled: stampsFilled, total: settings.stampsPerCard })}
          filled={stampsFilled}
          total={settings.stampsPerCard}
          seed={viewer?.id ?? "cards-center"}
          reward={settings.stampReward || t("loyaltyStampRewardEmpty")}
          status={t("loyaltyStampStatus")}
        />
        <PointsTile
          badge={t("loyaltyPointsBadge")}
          value={loyalty ? loyalty.points.balance : fullCardPoints}
          label={loyalty ? t("loyaltyPointsLabelMember") : t("loyaltyPointsLabelGuest")}
          earn={earn}
          redeemTitle={t("loyaltyRedeemTitle")}
          redeemText={t("loyaltyRedeemText")}
          status={t("loyaltyPointsStatus")}
        />
      </LoyaltyPanel>
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
          { title: t("audCollectorsTitle"), description: t("audCollectorsDesc"), color: "pink", bullets: [t(cardDb ? "audCollectorsB1" : "audCollectorsB1Sell"), t("audCollectorsB2"), t("audCollectorsB3"), t("audCollectorsB4")], ctaLabel: t("audCollectorsCta"), ctaHref: "/verkopen" },
        ]}
      />
      {quotes.length >= 3 && (
        <section className="flex justify-center px-4 py-12 sm:px-5 lg:px-6 lg:py-16">
          <div className="w-full max-w-6xl">
            <SectionHead
              eyebrow={t("testimonialsEyebrow")}
              eyebrowColor="pink"
              title={t("testimonialsTitle")}
              intro={t("testimonialsIntro")}
              action={
                <CtaButton href="/ervaringen" variant="light">
                  {t("testimonialsAll")}
                </CtaButton>
              }
            />
            <TestimonialWall items={quotes} columns={3} />
          </div>
        </section>
      )}
      <CtaSection
        title={t("ctaTitle")}
        description={t("ctaDesc")}
        placeholder={t("ctaPlaceholder")}
        buttonLabel={t("ctaButton")}
        reassurance={t("ctaReassurance")}
        loggedIn={!!viewer}
        dashboardLabel={t("ctaDashboard")}
      />
    </div>
  );
}
