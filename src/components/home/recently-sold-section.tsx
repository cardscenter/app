"use client";

import Image from "next/image";
import { useTranslations, useFormatter, useNow } from "next-intl";
import { Gavel, Package, Store, Tag, TrendingUp } from "lucide-react";
import { AnimatedSection } from "@/components/home/animated-section";
import { HomeCarousel, CarouselSlide } from "@/components/home/home-carousel";
import { Link } from "@/i18n/navigation";
import type { RecentlySoldItem } from "@/lib/home-recently-sold";

interface RecentlySoldSectionProps {
  items: RecentlySoldItem[];
  bgClass?: string;
}

const KIND_META = {
  auction: { Icon: Gavel, labelKey: "recentlySoldKindAuction", color: "text-sky-600 dark:text-sky-400" },
  listing: { Icon: Store, labelKey: "recentlySoldKindListing", color: "text-emerald-600 dark:text-emerald-400" },
  bundle: { Icon: Package, labelKey: "recentlySoldKindBundle", color: "text-violet-600 dark:text-violet-400" },
  claimsale: { Icon: Tag, labelKey: "recentlySoldKindClaimsale", color: "text-amber-600 dark:text-amber-400" },
} as const;

export function RecentlySoldSection({ items, bgClass = "bg-card" }: RecentlySoldSectionProps) {
  const t = useTranslations("home");
  const format = useFormatter();
  // Stable reference voor relativeTime — voorkomt ENVIRONMENT_FALLBACK in next-intl.
  const now = useNow();

  if (items.length === 0) return null;

  return (
    <section className={`py-12 lg:py-16 ${bgClass}`}>
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <AnimatedSection>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
                <TrendingUp className="size-3" />
                {t("recentlySoldEyebrow")}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                {t("recentlySoldTitle")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {t("recentlySoldSubtitle")}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <HomeCarousel fadeFromClass={bgClass === "bg-card" ? "from-card" : "from-background"}>
              {items.map((item) => {
                const meta = KIND_META[item.kind];
                const Icon = meta.Icon;
                return (
                  <CarouselSlide key={item.bundleId}>
                    <Link
                      href={`/verkoper/${item.sellerId}`}
                      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-card-hover"
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-muted">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Icon className="size-10 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm">
                          <Icon className={`size-3 ${meta.color}`} />
                          {t(meta.labelKey)}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-3 sm:p-4">
                        <div>
                          <h3 className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</h3>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{item.sellerDisplayName}</p>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-2">
                          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 sm:text-xl">
                            {format.number(item.soldPrice, { style: "currency", currency: "EUR" })}
                          </div>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {format.relativeTime(item.soldAt, now)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </CarouselSlide>
                );
              })}
            </HomeCarousel>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
