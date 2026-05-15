import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Tag, Gavel, Store, ArrowRight, ShoppingCart, Euro } from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/home/animated-section";
import { AnimatedCounter } from "@/components/home/animated-counter";
import type { HomepageStats } from "@/lib/homepage-data";

type Accent = "blue" | "amber" | "emerald";

interface PathDef {
  accent: Accent;
  Icon: typeof Tag;
  titleKey: string;
  countLabelKey: string;
  statKey: keyof HomepageStats;
  buyDescKey: string;
  buyCtaKey: string;
  buyHref: string;
  sellDescKey: string;
  sellCtaKey: string;
  sellHref: string;
}

const PATHS: PathDef[] = [
  {
    accent: "blue",
    Icon: Gavel,
    titleKey: "pathAuctionsTitle",
    countLabelKey: "activeAuctions",
    statKey: "activeAuctions",
    buyDescKey: "pathAuctionsBuyDesc",
    buyCtaKey: "pathAuctionsBuyCta",
    buyHref: "/veilingen",
    sellDescKey: "pathAuctionsSellDesc",
    sellCtaKey: "pathAuctionsSellCta",
    sellHref: "/veilingen/nieuw",
  },
  {
    accent: "amber",
    Icon: Tag,
    titleKey: "pathClaimsalesTitle",
    countLabelKey: "activeClaimsales",
    statKey: "activeClaimsales",
    buyDescKey: "pathClaimsalesBuyDesc",
    buyCtaKey: "pathClaimsalesBuyCta",
    buyHref: "/claimsales",
    sellDescKey: "pathClaimsalesSellDesc",
    sellCtaKey: "pathClaimsalesSellCta",
    sellHref: "/claimsales/nieuw",
  },
  {
    accent: "emerald",
    Icon: Store,
    titleKey: "pathMarketplaceTitle",
    countLabelKey: "activeListings",
    statKey: "activeListings",
    buyDescKey: "pathMarketplaceBuyDesc",
    buyCtaKey: "pathMarketplaceBuyCta",
    buyHref: "/marktplaats",
    sellDescKey: "pathMarketplaceSellDesc",
    sellCtaKey: "pathMarketplaceSellCta",
    sellHref: "/marktplaats/nieuw",
  },
];

const ACCENT_CLASSES: Record<
  Accent,
  { iconBg: string; iconText: string; ring: string; cta: string; countText: string }
> = {
  blue: {
    iconBg: "bg-blue-50 dark:bg-blue-900/40",
    iconText: "text-blue-600 dark:text-blue-300",
    ring: "ring-blue-100 dark:ring-blue-900",
    cta: "text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200",
    countText: "text-blue-700 dark:text-blue-300",
  },
  amber: {
    iconBg: "bg-amber-50 dark:bg-amber-900/40",
    iconText: "text-amber-600 dark:text-amber-300",
    ring: "ring-amber-100 dark:ring-amber-900",
    cta: "text-amber-600 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200",
    countText: "text-amber-700 dark:text-amber-300",
  },
  emerald: {
    iconBg: "bg-emerald-50 dark:bg-emerald-900/40",
    iconText: "text-emerald-600 dark:text-emerald-300",
    ring: "ring-emerald-100 dark:ring-emerald-900",
    cta: "text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200",
    countText: "text-emerald-700 dark:text-emerald-300",
  },
};

interface HowItWorksThreePathsProps {
  stats: HomepageStats;
}

export function HowItWorksThreePaths({ stats }: HowItWorksThreePathsProps) {
  const t = useTranslations("home");

  return (
    <section className="bg-card py-16 lg:py-24">
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t("threePathsTitle")}
          </h2>
        </div>

        <StaggerContainer className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3" staggerDelay={0.12}>
          {PATHS.map((path) => {
            const a = ACCENT_CLASSES[path.accent];
            const count = stats[path.statKey];
            return (
              <StaggerItem key={path.titleKey}>
                <div className="glass-soft-card flex h-full flex-col p-7">
                  {/* Top-row: icon links + count rechts */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`inline-flex size-12 items-center justify-center rounded-xl ring-1 ${a.iconBg} ${a.ring}`}
                    >
                      <path.Icon className={`size-6 ${a.iconText}`} />
                    </div>
                    <div className="text-right">
                      <AnimatedCounter
                        value={count}
                        className={`block text-2xl font-bold leading-none ${a.countText}`}
                      />
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t(path.countLabelKey)}
                      </p>
                    </div>
                  </div>

                  <h3 className="mt-5 text-xl font-semibold text-foreground">
                    {t(path.titleKey)}
                  </h3>

                  {/* Kopen-blok */}
                  <div className="mt-5">
                    <div className="flex items-center gap-1.5">
                      <ShoppingCart className={`size-3.5 ${a.iconText}`} />
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${a.iconText}`}>
                        {t("pathSectionBuy")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(path.buyDescKey)}
                    </p>
                    <Link
                      href={path.buyHref}
                      className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${a.cta}`}
                    >
                      {t(path.buyCtaKey)}
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>

                  <div className="my-5 border-t border-border/60" />

                  {/* Verkopen-blok */}
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-center gap-1.5">
                      <Euro className={`size-3.5 ${a.iconText}`} />
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${a.iconText}`}>
                        {t("pathSectionSell")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(path.sellDescKey)}
                    </p>
                    <Link
                      href={path.sellHref}
                      className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${a.cta}`}
                    >
                      {t(path.sellCtaKey)}
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
