"use client";

import { useTranslations } from "next-intl";
import { ShoppingBag, TrendingUp, Users, Star } from "lucide-react";
import { AnimatedCounter } from "@/components/home/animated-counter";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/home/animated-section";
import type { PlatformStats } from "@/lib/homepage-data";

interface PlatformStatsSectionProps {
  stats: PlatformStats;
}

export function PlatformStatsSection({ stats }: PlatformStatsSectionProps) {
  const t = useTranslations("home");

  const items = [
    {
      icon: ShoppingBag,
      value: stats.totalCompletedSales,
      label: t("totalSalesCompleted"),
      color: "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    },
    {
      icon: TrendingUp,
      value: stats.totalValueTraded,
      label: t("totalValueTraded"),
      prefix: "\u20AC",
      color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    },
    {
      icon: Users,
      value: stats.totalMembers,
      label: t("totalMembers"),
      color: "bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    },
    {
      icon: Star,
      value: stats.avgRating,
      label: t("avgRating"),
      decimals: 1,
      suffix: "/5",
      color: "bg-amber-50 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    },
  ];

  return (
    <section className="py-8 sm:py-14 border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <h2 className="text-center text-2xl font-bold text-foreground">{t("platformStats")}</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">{t("platformStatsDesc")}</p>
        </AnimatedSection>

        <StaggerContainer className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4" staggerDelay={0.1}>
          {items.map((item) => (
            <StaggerItem key={item.label}>
              <div className="glass rounded-2xl p-6 text-center transition-all hover:shadow-lg">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${item.color}`}>
                  <item.icon className="size-6" />
                </div>
                <AnimatedCounter
                  value={item.value}
                  prefix={item.prefix}
                  suffix={item.suffix}
                  decimals={item.decimals}
                  className="mt-4 block text-3xl font-bold text-foreground"
                  duration={2}
                />
                <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
