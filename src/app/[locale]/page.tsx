import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getHomepageData } from "@/lib/homepage-data";
import { Gavel, Tag, Store, Clock, TrendingUp } from "lucide-react";

import { MarketingHero } from "@/components/home/marketing-hero";
import { LoggedInHero } from "@/components/home/logged-in-hero";
import { MainSectionsGrid } from "@/components/home/main-sections-grid";
import { CategoryStatsStrip } from "@/components/home/category-stats-strip";
import { SponsoredSpotlight } from "@/components/home/sponsored-spotlight";
import { TopSellersSection } from "@/components/home/top-sellers-section";
import { PlatformStatsSection } from "@/components/home/platform-stats-section";
import { FeaturesSection } from "@/components/home/features-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { PricingSection } from "@/components/home/pricing-section";
import { CtaBanner } from "@/components/home/cta-banner";
import { SectionDivider } from "@/components/home/section-divider";
import { SectionHeader } from "@/components/home/section-header";
import { AnimatedSection } from "@/components/home/animated-section";
import { HomeCarousel, CarouselSlide } from "@/components/home/home-carousel";

import { AuctionCard } from "@/components/auction/auction-card";
import { ClaimsaleCard } from "@/components/claimsale/claimsale-card";
import { ListingCard } from "@/components/listing/listing-card";

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
  const data = await getHomepageData();

  const isLoggedIn = !!session?.user;

  return (
    <div className="flex flex-col">
      {/* Hero */}
      {isLoggedIn ? (
        <LoggedInHero userName={session.user?.name ?? ""} stats={data.stats} />
      ) : (
        <MarketingHero stats={data.stats} />
      )}

      {/* Finn & Sage visual entry points to the three main sections (logged-in only) */}
      {isLoggedIn && <MainSectionsGrid />}

      {/* Category Stats */}
      <CategoryStatsStrip stats={data.stats} />

      {/* Sponsored Spotlight */}
      <SponsoredSpotlight
        auctions={data.sponsoredAuctions}
        listings={data.sponsoredListings}
        locale={locale}
      />

      {/* Ending Soon */}
      {data.endingSoonAuctions.length > 0 && (
        <ItemSection
          icon={<Clock className="size-4" />}
          iconClass="bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300"
          titleKey="endingSoon"
          descriptionKey="endingSoonDesc"
          href="/veilingen?sort=ending"
          linkColor="text-red-600 hover:text-red-700"
          bgClass="bg-background"
        >
          <HomeCarousel>
            {data.endingSoonAuctions.map((auction) => (
              <CarouselSlide key={auction.id}>
                <AuctionCard auction={auction} />
              </CarouselSlide>
            ))}
          </HomeCarousel>
        </ItemSection>
      )}

      {/* Trending */}
      {data.trendingAuctions.length > 0 && (
        <ItemSection
          icon={<TrendingUp className="size-4" />}
          iconClass="bg-orange-50 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
          titleKey="trending"
          descriptionKey="trendingDesc"
          href="/veilingen?sort=bids"
          linkColor="text-orange-600 hover:text-orange-700"
          bgClass="border-t border-border section-gradient-alt"
        >
          <HomeCarousel>
            {data.trendingAuctions.map((auction) => (
              <CarouselSlide key={auction.id}>
                <AuctionCard auction={auction} />
              </CarouselSlide>
            ))}
          </HomeCarousel>
        </ItemSection>
      )}

      <SectionDivider />

      {/* Recent Auctions */}
      {data.recentAuctions.length > 0 && (
        <ItemSection
          icon={<Gavel className="size-4" />}
          iconClass="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          titleKey="recentAuctions"
          href="/veilingen"
          linkColor="text-primary hover:text-primary-hover"
          bgClass="bg-background"
        >
          <HomeCarousel>
            {data.recentAuctions.map((auction) => (
              <CarouselSlide key={auction.id}>
                <AuctionCard auction={auction} />
              </CarouselSlide>
            ))}
          </HomeCarousel>
        </ItemSection>
      )}

      {/* Recent Claimsales */}
      {data.recentClaimsales.length > 0 && (
        <ItemSection
          icon={<Tag className="size-4" />}
          iconClass="bg-amber-50 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
          titleKey="recentClaimsales"
          href="/claimsales"
          linkColor="text-amber-600 hover:text-amber-700"
          bgClass="border-t border-border section-gradient-alt"
        >
          <HomeCarousel>
            {data.recentClaimsales.map((claimsale) => (
              <CarouselSlide key={claimsale.id}>
                <ClaimsaleCard claimsale={claimsale} />
              </CarouselSlide>
            ))}
          </HomeCarousel>
        </ItemSection>
      )}

      {/* Recent Listings */}
      {data.recentListings.length > 0 && (
        <ItemSection
          icon={<Store className="size-4" />}
          iconClass="bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
          titleKey="recentListings"
          href="/marktplaats"
          linkColor="text-emerald-600 hover:text-emerald-700"
          bgClass="border-t border-border bg-background"
        >
          <HomeCarousel>
            {data.recentListings.map((listing) => (
              <CarouselSlide key={listing.id}>
                <ListingCard listing={listing} locale={locale} />
              </CarouselSlide>
            ))}
          </HomeCarousel>
        </ItemSection>
      )}

      <SectionDivider />

      {/* Top Sellers */}
      <TopSellersSection sellers={data.topSellers} />

      {/* Platform Statistics */}
      <PlatformStatsSection stats={data.platformStats} />

      {/* Features */}
      <FeaturesSection />

      {/* Visitors-only sections */}
      {!isLoggedIn && (
        <>
          <HowItWorksSection />
          <PricingSection />
          <CtaBanner />
        </>
      )}
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
    <section className={`py-8 sm:py-12 ${bgClass}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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

