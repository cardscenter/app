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
    <section className="relative overflow-hidden bg-background text-foreground dark:bg-slate-950 dark:text-white">
      {/* Subtiele radial glow — alleen zichtbaar in dark mode */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 85% 0%, rgba(59, 130, 246, 0.08), transparent 60%), radial-gradient(ellipse 50% 40% at 10% 100%, rgba(139, 92, 246, 0.06), transparent 60%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[1680px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20 xl:px-10">
        {/* Zone header */}
        <AnimatedSection>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl dark:text-white">
                {t("liveAuctionsZoneTitle")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base dark:text-slate-400">
                {t("liveAuctionsZoneSubtitle")}
              </p>
            </div>
            <Link
              href="/veilingen"
              className="inline-flex items-center gap-1.5 rounded-md bg-card px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted dark:bg-white/5 dark:text-white dark:ring-white/15 dark:hover:bg-white/10"
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
                <HomeCarousel fadeFromClass="from-background dark:from-slate-950">
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
                <HomeCarousel fadeFromClass="from-background dark:from-slate-950">
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
                <HomeCarousel fadeFromClass="from-background dark:from-slate-950">
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
    rose: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
    amber: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
    sky: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  };

  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex size-8 items-center justify-center rounded-lg ring-1 ${accentBg[accent]}`}>
        <Icon className="size-4" />
      </span>
      <h3 className="text-lg font-semibold text-foreground dark:text-white">{title}</h3>
    </div>
  );
}
