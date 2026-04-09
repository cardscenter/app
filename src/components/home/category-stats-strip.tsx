"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Gavel, Tag, Store, ArrowRight } from "lucide-react";
import { AnimatedCounter } from "@/components/home/animated-counter";
import type { HomepageStats } from "@/lib/homepage-data";

interface CategoryStatsStripProps {
  stats: HomepageStats;
}

export function CategoryStatsStrip({ stats }: CategoryStatsStripProps) {
  const t = useTranslations("home");

  const categories = [
    {
      href: "/veilingen" as const,
      count: stats.activeAuctions,
      label: t("activeAuctions"),
      Icon: Gavel,
      iconClass: "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      hoverClass: "hover:bg-primary/5",
      hoverIconClass: "group-hover:bg-primary group-hover:text-white",
    },
    {
      href: "/claimsales" as const,
      count: stats.activeClaimsales,
      label: t("activeClaimsales"),
      Icon: Tag,
      iconClass: "bg-amber-50 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      hoverClass: "hover:bg-amber-500/5",
      hoverIconClass: "group-hover:bg-amber-600 group-hover:text-white",
    },
    {
      href: "/marktplaats" as const,
      count: stats.activeListings,
      label: t("activeListings"),
      Icon: Store,
      iconClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
      hoverClass: "hover:bg-emerald-500/5",
      hoverIconClass: "group-hover:bg-emerald-600 group-hover:text-white",
    },
  ];

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 divide-border">
          {categories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className={`group flex items-center gap-3 py-4 px-4 sm:py-5 transition-colors ${cat.hoverClass}`}
            >
              <div className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl ${cat.iconClass} transition-colors ${cat.hoverIconClass}`}>
                <cat.Icon className="size-4 sm:size-5" />
              </div>
              <div className="flex-1">
                <AnimatedCounter
                  value={cat.count}
                  className="text-lg sm:text-xl font-bold text-foreground block"
                />
                <p className="text-xs text-muted-foreground">{cat.label}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground sm:hidden" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
