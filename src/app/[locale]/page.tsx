import { Fragment } from "react";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getHomepageData } from "@/lib/homepage-data";
import { pickDailyBanner } from "@/lib/hero-banners";
import { getBuyerLocation } from "@/lib/shipping/filter";
import { fetchActionItems, type ActionItemsCounts } from "@/lib/dashboard-queries";
import { getFeatureSnapshot } from "@/lib/feature-flags";
import { maskActionItems } from "@/lib/dashboard-feature-mask";
import { Tag, Store } from "lucide-react";
import { ZDivider } from "@/components/ui/z-divider";

import { MarketingHeroV2 } from "@/components/home/marketing-hero-v2";
import { HubHomepage } from "@/components/home/hub-homepage";
import { LandingPage } from "@/components/home/landing/landing-page";
import { LoggedInHeroV2 } from "@/components/home/logged-in-hero-v2";
import { SponsoredSpotlight } from "@/components/home/sponsored-spotlight";
import { HowItWorksThreePaths } from "@/components/home/how-it-works-three-paths";
import { TrustPillarsSection } from "@/components/home/trust-pillars-section";
// TestimonialsSection: tijdelijk uit (zie sectie 12 hieronder).
// import { TestimonialsSection } from "@/components/home/testimonials-section";
import { LiveAuctionsZone } from "@/components/home/live-auctions-zone";
import { ClaimsalesScrollStory } from "@/components/home/claimsales-scroll-story";
import { SectionHeader } from "@/components/home/section-header";
import { AnimatedSection } from "@/components/home/animated-section";
import { HomeCarousel, CarouselSlide } from "@/components/home/home-carousel";
import { EmptyHomeSection } from "@/components/home/empty-home-section";
import { RecentlySoldSection } from "@/components/home/recently-sold-section";
import { SpotlightEvents } from "@/components/home/spotlight-events";
import { BuyerProtectionSection } from "@/components/home/buyer-protection-section";
import { TierComparisonHomepage } from "@/components/home/tier-comparison-homepage";
import { CompetitorComparisonSection } from "@/components/home/competitor-comparison-section";
import { FaqSection } from "@/components/home/faq-section";

import { ClaimsaleCard } from "@/components/claimsale/claimsale-card";
import { ListingCard } from "@/components/listing/listing-card";

import { getTranslations } from "next-intl/server";

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <HomePageContent params={params} />;
}

async function HomePageContent({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const [data, buyerLocation, t] = await Promise.all([
    getHomepageData(),
    getBuyerLocation(),
    getTranslations("home"),
  ]);

  const isLoggedIn = !!session?.user;
  const accountType = session?.user?.accountType;
  // Feature-flags per bezoeker (Community Hub, Fase 1): handel-secties alleen
  // zolang hun flag zichtbaar is. De marketing-blokken over handelen (escrow,
  // tiers, FAQ, concurrentie) hangen allemaal aan het saldo-model.
  const features = getFeatureSnapshot(accountType);
  const anyTrade = features.FEATURE_AUCTIONS || features.FEATURE_CLAIMSALES || features.FEATURE_MARKETPLACE;

  // Community Hub (Fase 5): zonder handel en saldo is de hub-startpagina de
  // homepage (events, nieuws, league, info). De marketing-homepage hieronder
  // blijft bestaan voor als de handel terugkomt.
  if (!anyTrade && !features.FEATURE_WALLET) {
    // Design-pass (2026-10): nieuwe homepage in Ploy-stijl. HOMEPAGE_LEGACY=true
    // zet de vorige hub-homepage terug (backup, ongewijzigd).
    if (process.env.HOMEPAGE_LEGACY === "true") {
      return <HubHomepage locale={locale} viewer={session?.user?.id ? { id: session.user.id, name: session.user.name ?? "" } : null} />;
    }
    return <LandingPage locale={locale} viewer={session?.user?.id ? { id: session.user.id, name: session.user.name ?? "", image: session.user.image ?? null } : null} />;
  }

  // Fase 37: action-items voor de "Sinds je vorige bezoek"-strip op de hero.
  // Alleen voor logged-in users — anders skip de query.
  let actionItems: ActionItemsCounts | null = null;
  if (isLoggedIn && session?.user?.id) {
    actionItems = maskActionItems(await fetchActionItems(session.user.id), features);
  }
  // Tier-comparison sectie tonen aan: alle logged-out users + logged-in FREE-tier users
  // (zodat FREE upgrade-opties ziet op de homepage). PRO/UNLIMITED/ENTERPRISE-users
  // verbergen we omdat ze hun plan al beheren via /dashboard/abonnement.
  const showTierComparison =
    features.FEATURE_WALLET && (!isLoggedIn || accountType === "FREE" || !accountType);
  const hasRecentClaimsales = data.recentClaimsales.length > 0;
  const hasRecentListings = data.recentListings.length > 0;

  // Bouw de sectie-lijst met per sectie de surface-kleur. Tussen twee
  // opeenvolgende secties met VERSCHILLENDE surface zetten we automatisch een
  // Z-divider (zelfde kleur = geen zichtbare divider nodig). Zo blijven alle
  // conditionele secties (logged-in/out, FREE-tier) correct werken.
  const sections: {
    surface: Surface;
    node: React.ReactNode;
    desktopOnly?: boolean;
  }[] = [];

  // 1. Hero — bg-slate-950
  sections.push({
    surface: "hero",
    node: isLoggedIn ? (
      <LoggedInHeroV2
        userName={session.user?.name ?? ""}
        stats={data.stats}
        bannerSrc={pickDailyBanner()}
        actionItems={actionItems}
      />
    ) : (
      <MarketingHeroV2 stats={data.stats} platformStats={data.platformStats} features={features} />
    ),
  });

  // 2. 3-paden uitleg (logged-out only) — bg-card
  if (!isLoggedIn && anyTrade) {
    sections.push({ surface: "card", node: <HowItWorksThreePaths stats={data.stats} /> });
  }

  // 3. Scroll-pinned storytelling (logged-out only) — bg-background
  if (!isLoggedIn && features.FEATURE_CLAIMSALES) {
    sections.push({ surface: "bg", node: <ClaimsalesScrollStory /> });
  }

  // 4. Sponsored Spotlight — bg-card. Alleen tonen als er content is (anders
  //    rendert de sectie null → zou twee dividers op elkaar geven).
  const sponsoredAuctions = features.FEATURE_AUCTIONS ? data.sponsoredAuctions : [];
  const sponsoredListings = features.FEATURE_MARKETPLACE ? data.sponsoredListings : [];
  const hasSponsored = sponsoredAuctions.length > 0 || sponsoredListings.length > 0;
  if (hasSponsored) {
    sections.push({
      surface: "card",
      node: (
        <SponsoredSpotlight
          auctions={sponsoredAuctions}
          listings={sponsoredListings}
          locale={locale}
          buyer={buyerLocation}
        />
      ),
    });
  }

  // 4b. Uitgelichte evenementen — bg-background. Alleen tonen als er events met
  //     een actieve HOMEPAGE_SPOTLIGHT-upsell zijn (anders rendert de sectie null).
  if (features.FEATURE_COMMUNITY_EVENTS && data.spotlightEvents.length > 0) {
    sections.push({
      surface: "bg",
      node: <SpotlightEvents items={data.spotlightEvents} locale={locale} bgClass="bg-background" />,
    });
  }

  // 5. Live veilingen — bg-background (light) / slate-950 (dark). Alleen tonen
  //    als er veilingen zijn (anders rendert de sectie null).
  const hasLiveAuctions =
    features.FEATURE_AUCTIONS &&
    (data.endingSoonAuctions.length > 0 ||
      data.trendingAuctions.length > 0 ||
      data.recentAuctions.length > 0);
  if (hasLiveAuctions) {
    sections.push({
      surface: "live",
      node: (
        <LiveAuctionsZone
          endingSoon={data.endingSoonAuctions}
          trending={data.trendingAuctions}
          recent={data.recentAuctions}
        />
      ),
    });
  }

  // 6. Recent Claimsales — bg-card (of EmptyHomeSection fallback)
  if (features.FEATURE_CLAIMSALES) sections.push({
    surface: "card",
    node: hasRecentClaimsales ? (
      <ItemSection
        icon={<Tag className="size-4" />}
        iconClass="bg-amber-50 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
        titleKey="recentClaimsales"
        href="/claimsales"
        linkColor="text-amber-600 hover:text-amber-700"
        bgClass="bg-card"
      >
        <HomeCarousel>
          {data.recentClaimsales.map((claimsale) => (
            <CarouselSlide key={claimsale.id}>
              <ClaimsaleCard claimsale={claimsale} buyer={buyerLocation} />
            </CarouselSlide>
          ))}
        </HomeCarousel>
      </ItemSection>
    ) : (
      <EmptyHomeSection
        icon={<Tag className="size-5" />}
        iconClass="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        title={t("emptyRecentClaimsalesTitle")}
        description={t("emptyRecentClaimsalesDesc")}
        ctaLabel={t("emptyRecentClaimsalesCta")}
        ctaHref="/claimsales"
        bgClass="bg-card"
      />
    ),
  });

  // 7. Recent Listings — bg-background (of EmptyHomeSection fallback)
  if (features.FEATURE_MARKETPLACE) sections.push({
    surface: "bg",
    node: hasRecentListings ? (
      <ItemSection
        icon={<Store className="size-4" />}
        iconClass="bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
        titleKey="recentListings"
        href="/marktplaats"
        linkColor="text-emerald-600 hover:text-emerald-700"
        bgClass="bg-background"
      >
        <HomeCarousel>
          {data.recentListings.map((listing) => (
            <CarouselSlide key={listing.id}>
              <ListingCard listing={listing} locale={locale} buyer={buyerLocation} />
            </CarouselSlide>
          ))}
        </HomeCarousel>
      </ItemSection>
    ) : (
      <EmptyHomeSection
        icon={<Store className="size-5" />}
        iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
        title={t("emptyRecentListingsTitle")}
        description={t("emptyRecentListingsDesc")}
        ctaLabel={t("emptyRecentListingsCta")}
        ctaHref="/marktplaats"
        bgClass="bg-background"
      />
    ),
  });

  // 8. Recently Sold — bg-card (of EmptyHomeSection bij geen sales)
  if (features.FEATURE_WALLET) sections.push({
    surface: "card",
    node:
      data.recentlySoldItems.length > 0 ? (
        <RecentlySoldSection items={data.recentlySoldItems} bgClass="bg-card" />
      ) : (
        <EmptyHomeSection
          icon={<Tag className="size-5" />}
          iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          title={t("emptyRecentSoldTitle")}
          description={t("emptyRecentSoldDesc")}
          ctaLabel={t("emptyRecentSoldCta")}
          ctaHref="/veilingen"
          bgClass="bg-card"
        />
      ),
  });

  // 9. Trust Pillars (logged-out only) — bg-background
  if (!isLoggedIn && features.FEATURE_WALLET) {
    sections.push({ surface: "bg", node: <TrustPillarsSection /> });
  }

  // 10. Buyer-Protection deep-dive (logged-out only) — bg-card
  if (!isLoggedIn && features.FEATURE_WALLET) {
    sections.push({ surface: "card", node: <BuyerProtectionSection bgClass="bg-card" /> });
  }

  // 11. Tier-benefits — logged-out + logged-in FREE users. Effen bg-background
  //     i.p.v. section-gradient: een effen Z-divider-blade kan een animerende
  //     gradient niet matchen → gaf een kleurmismatch op de divider erboven.
  if (showTierComparison) {
    sections.push({
      surface: "bg",
      node: <TierComparisonHomepage bgClass="bg-background" isLoggedIn={isLoggedIn} />,
    });
  }

  // 11b. Concurrent-vergelijking — desktop-only, logged-out only. Eigen bg-card
  //      zodat 'ie contrasteert met Tier (boven) en FAQ (onder). De sectie is
  //      hidden md:block, dus de dividers eromheen ook (anders stapelen ze op mobile).
  if (!isLoggedIn && features.FEATURE_WALLET) {
    sections.push({
      surface: "card",
      desktopOnly: true,
      node: <CompetitorComparisonSection bgClass="bg-card" locale={locale} />,
    });
  }

  // 12. Testimonials — UITGESCHAKELD tot er echte quotes zijn. De teksten in
  //     `home.testimonial*` zijn placeholders; de gate op fiveStarReviewCount
  //     telt echte reviews maar zou die verzonnen quotes automatisch tonen.
  //     Heropenen: import + dit blok terugzetten en de i18n-quotes vervangen.
  // if (!isLoggedIn && data.fiveStarReviewCount >= 3) {
  //   sections.push({
  //     surface: "bg",
  //     node: <TestimonialsSection fiveStarCount={data.fiveStarReviewCount} />,
  //   });
  // }

  // 13. FAQ — voor iedereen — bg-background. De vragen gaan over handelen
  //     (claimsales, veilingen, escrow, commissie), dus alleen met het saldo-model.
  if (features.FEATURE_WALLET) {
    sections.push({ surface: "bg", node: <FaqSection bgClass="bg-background" /> });
  }

  return (
    <div className="flex flex-col">
      {sections.map((section, i) => {
        const prev = sections[i - 1];
        // Geen Z-divider direct onder de hero (dat is een afbeelding) — daar
        // scheidt het kleurcontrast de secties al.
        const needsDivider =
          prev && prev.surface !== section.surface && prev.surface !== "hero";
        return (
          <Fragment key={i}>
            {needsDivider && (
              <ZDivider
                className={`${SURFACE[prev.surface].bg}${
                  prev.desktopOnly || section.desktopOnly ? " hidden md:block" : ""
                }`}
                fillClassName={SURFACE[section.surface].fill}
              />
            )}
            {section.node}
          </Fragment>
        );
      })}
    </div>
  );
}

/* ── Surface-kleuren voor de Z-dividers ──
   bg  = achtergrondkleur van de BOVENSTE sectie (wrapper van de divider)
   fill = vulkleur van de blade = kleur van de ONDERSTE sectie
   Responsive classes voor secties die in dark mode een andere kleur hebben. */
type Surface = "hero" | "card" | "bg" | "live";

const SURFACE: Record<Surface, { bg: string; fill: string }> = {
  hero: { bg: "bg-slate-950", fill: "text-slate-950" },
  card: { bg: "bg-card", fill: "text-card" },
  bg: { bg: "bg-background", fill: "text-background" },
  live: {
    bg: "bg-background dark:bg-slate-950",
    fill: "text-background dark:text-slate-950",
  },
};

/* ── Item Section Wrapper ── */

function ItemSection({
  icon,
  iconClass,
  titleKey,
  descriptionKey,
  href,
  linkColor,
  bgClass,
  children,
}: {
  icon: React.ReactNode;
  iconClass: string;
  titleKey: string;
  descriptionKey?: string;
  href: string;
  linkColor: string;
  bgClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`py-12 lg:py-16 ${bgClass}`}>
      <div className="mx-auto max-w-[1880px] px-[clamp(1rem,3vw,4rem)]">
        <AnimatedSection>
          <SectionHeader
            icon={icon}
            iconClass={iconClass}
            titleKey={titleKey}
            descriptionKey={descriptionKey}
            href={href}
            linkColor={linkColor}
          />
          <div className="mt-6">
            {children}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
