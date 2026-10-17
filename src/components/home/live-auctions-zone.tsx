import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Clock, TrendingUp, Sparkles } from "lucide-react";
import { HomeCarousel, CarouselSlide } from "@/components/home/home-carousel";
import { HomeAuctionCard } from "@/components/home/home-auction-card";
import { AnimatedSection } from "@/components/home/animated-section";
import type { AuctionCardData } from "@/components/auction/auction-card";

type Auction = AuctionCardData & {
  sellerId: string;
  condition?: string | null;
  reservePrice?: number | null;
  seller: AuctionCardData["seller"] & { avatarUrl?: string | null };
};

interface LiveAuctionsZoneProps {
  endingSoon: Auction[];
  trending: Auction[];
  recent: Auction[];
}

export function LiveAuctionsZone({ endingSoon, trending, recent }: LiveAuctionsZoneProps) {
  const t = useTranslations("home");

  if (endingSoon.length === 0 && trending.length === 0 && recent.length === 0) {
    return null;
  }

  return (
    <section className="relative overflow-hidden bg-background text-foreground">
      {/* Subtiele radial glow — alleen zichtbaar in dark mode */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 85% 0%, rgba(59, 130, 246, 0.08), transparent 60%), radial-gradient(ellipse 50% 40% at 10% 100%, rgba(139, 92, 246, 0.06), transparent 60%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[1880px] px-[clamp(1rem,3vw,4rem)] py-16 lg:py-20">
        {/* Zone header */}
        <AnimatedSection>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {t("liveAuctionsZoneTitle")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {t("liveAuctionsZoneSubtitle")}
              </p>
            </div>
            <Link
              href="/veilingen"
              className="inline-flex items-center gap-1.5 rounded-md bg-card px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted"
            >
              {t("liveAuctionsViewAll")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </AnimatedSection>

        {/* Sub-rij: Eindigt binnenkort */}
        {endingSoon.length > 0 && (
          <AnimatedSection>
            <div className="mt-12">
              <SubRowHeader Icon={Clock} title={t("liveAuctionsRowEnding")} accent="rose" />
              <div className="mt-5">
                <HomeCarousel fadeFromClass="from-background">
                  {endingSoon.map((auction) => (
                    <CarouselSlide key={auction.id}>
                      <HomeAuctionCard auction={auction} />
                    </CarouselSlide>
                  ))}
                </HomeCarousel>
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* Sub-rij: Populair */}
        {trending.length > 0 && (
          <AnimatedSection>
            <div className="mt-12">
              <SubRowHeader Icon={TrendingUp} title={t("liveAuctionsRowTrending")} accent="amber" />
              <div className="mt-5">
                <HomeCarousel fadeFromClass="from-background">
                  {trending.map((auction) => (
                    <CarouselSlide key={auction.id}>
                      <HomeAuctionCard auction={auction} />
                    </CarouselSlide>
                  ))}
                </HomeCarousel>
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* Sub-rij: Net toegevoegd */}
        {recent.length > 0 && (
          <AnimatedSection>
            <div className="mt-12">
              <SubRowHeader Icon={Sparkles} title={t("liveAuctionsRowRecent")} accent="sky" />
              <div className="mt-5">
                <HomeCarousel fadeFromClass="from-background">
                  {recent.map((auction) => (
                    <CarouselSlide key={auction.id}>
                      <HomeAuctionCard auction={auction} />
                    </CarouselSlide>
                  ))}
                </HomeCarousel>
              </div>
            </div>
          </AnimatedSection>
        )}
      </div>
    </section>
  );
}

function SubRowHeader({
  Icon,
  title,
  accent,
}: {
  Icon: typeof Clock;
  title: string;
  accent: "rose" | "amber" | "sky";
}) {
  const accentBg: Record<typeof accent, string> = {
    rose: "bg-rose-100 text-rose-700 ring-rose-200",
    amber: "bg-amber-100 text-amber-700 ring-amber-200",
    sky: "bg-sky-100 text-sky-700 ring-sky-200",
  };

  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex size-8 items-center justify-center rounded-lg ring-1 ${accentBg[accent]}`}>
        <Icon className="size-4" />
      </span>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
    </div>
  );
}
