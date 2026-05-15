import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getHomepageData } from "@/lib/homepage-data";
import { pickDailyBanner } from "@/lib/hero-banners";
import { getBuyerLocation } from "@/lib/shipping/filter";
import { fetchActionItems, type ActionItemsCounts } from "@/lib/dashboard-queries";
import { Tag, Store, Users } from "lucide-react";

import { MarketingHeroV2 } from "@/components/home/marketing-hero-v2";
import { LoggedInHeroV2 } from "@/components/home/logged-in-hero-v2";
import { SponsoredSpotlight } from "@/components/home/sponsored-spotlight";
import { TopSellersSection } from "@/components/home/top-sellers-section";
import { PlatformStatsSection } from "@/components/home/platform-stats-section";
import { HowItWorksThreePaths } from "@/components/home/how-it-works-three-paths";
import { TrustPillarsSection } from "@/components/home/trust-pillars-section";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { LiveAuctionsZone } from "@/components/home/live-auctions-zone";
import { ClaimsalesScrollStory } from "@/components/home/claimsales-scroll-story";
import { SectionHeader } from "@/components/home/section-header";
import { AnimatedSection } from "@/components/home/animated-section";
import { HomeCarousel, CarouselSlide } from "@/components/home/home-carousel";
import { EmptyHomeSection } from "@/components/home/empty-home-section";
import { RecentlySoldSection } from "@/components/home/recently-sold-section";
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

  // Fase 37: action-items voor de "Sinds je vorige bezoek"-strip op de hero.
  // Alleen voor logged-in users — anders skip de query.
  let actionItems: ActionItemsCounts | null = null;
  if (isLoggedIn && session?.user?.id) {
    actionItems = await fetchActionItems(session.user.id);
  }
  // Tier-comparison sectie tonen aan: alle logged-out users + logged-in FREE-tier users
  // (zodat FREE upgrade-opties ziet op de homepage). PRO/UNLIMITED/ENTERPRISE-users
  // verbergen we omdat ze hun plan al beheren via /dashboard/abonnement.
  const showTierComparison = !isLoggedIn || accountType === "FREE" || !accountType;
  const hasRecentClaimsales = data.recentClaimsales.length > 0;
  const hasRecentListings = data.recentListings.length > 0;
  const hasTopSellers = data.topSellers.length > 0;

  return (
    <div className="flex flex-col">
      {/* 1. Hero (ongewijzigd — Fase 36 raakt deze niet aan) */}
      {isLoggedIn ? (
        <LoggedInHeroV2
          userName={session.user?.name ?? ""}
          stats={data.stats}
          bannerSrc={pickDailyBanner()}
          actionItems={actionItems}
        />
      ) : (
        <MarketingHeroV2
          stats={data.stats}
          platformStats={data.platformStats}
        />
      )}

      {/* 2. 3-paden uitleg (logged-out only) — bg-card */}
      {!isLoggedIn && <HowItWorksThreePaths stats={data.stats} />}

      {/* 3. Scroll-pinned storytelling (logged-out only) — bg-background */}
      {!isLoggedIn && <ClaimsalesScrollStory />}

      {/* 4. Sponsored Spotlight — bg-card */}
      <SponsoredSpotlight
        auctions={data.sponsoredAuctions}
        listings={data.sponsoredListings}
        locale={locale}
        buyer={buyerLocation}
      />

      {/* 5. Live veilingen — bg-background (light) / slate-950 (dark forced) */}
      <LiveAuctionsZone
        endingSoon={data.endingSoonAuctions}
        trending={data.trendingAuctions}
        recent={data.recentAuctions}
      />

      {/* 6. Recent Claimsales — bg-card (of EmptyHomeSection fallback) */}
      {hasRecentClaimsales ? (
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
      )}

      {/* 7. Recent Listings — bg-background (of EmptyHomeSection fallback) */}
      {hasRecentListings ? (
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
      )}

      {/* 8. Recently Sold — bg-card (of EmptyHomeSection bij geen sales) */}
      {data.recentlySoldItems.length > 0 ? (
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
      )}

      {/* 9. Trust Pillars (logged-out only) — bg-background */}
      {!isLoggedIn && <TrustPillarsSection />}

      {/* 10. Buyer-Protection deep-dive (logged-out only) — bg-card */}
      {!isLoggedIn && <BuyerProtectionSection bgClass="bg-card" />}

      {/* 11. Tier-benefits — logged-out + logged-in FREE users (upgrade-incentive) */}
      {showTierComparison && (
        <TierComparisonHomepage bgClass="section-gradient" isLoggedIn={isLoggedIn} />
      )}

      {/* 11b. Concurrent-vergelijking — desktop-only, logged-out only.
          Geen mobile variant: sectie is `hidden md:block`. */}
      {!isLoggedIn && <CompetitorComparisonSection bgClass="bg-background" locale={locale} />}

      {/* 12. Top Sellers — bg-card (of EmptyHomeSection) */}
      {hasTopSellers ? (
        <TopSellersSection sellers={data.topSellers} />
      ) : (
        <EmptyHomeSection
          icon={<Users className="size-5" />}
          iconClass="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
          title={t("emptyTopSellersTitle")}
          description={t("emptyTopSellersDesc")}
          ctaLabel={t("emptyTopSellersCta")}
          ctaHref={isLoggedIn ? "/marktplaats/nieuw" : "/register"}
          bgClass="bg-card"
        />
      )}

      {/* 13. Testimonials (logged-out only, conditional ≥3 5★) — bg-background */}
      {!isLoggedIn && <TestimonialsSection fiveStarCount={data.fiveStarReviewCount} />}

      {/* 14. Platform Statistics — bg-card */}
      <PlatformStatsSection stats={data.platformStats} />

      {/* 15. FAQ — voor iedereen, ook logged-in users vinden onboarding-info bruikbaar */}
      <FaqSection bgClass="bg-background" />
    </div>
  );
}

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
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
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
