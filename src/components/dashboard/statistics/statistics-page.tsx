"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { PeriodSelector } from "./period-selector";
import { SalesAnalytics, type SalesAnalyticsData } from "./sales-analytics";
import { SellerPerformance, type SellerPerformanceData } from "./seller-performance";
import { BuyerAnalytics, type BuyerAnalyticsData } from "./buyer-analytics";
import { XPLevelProgress, type XPLevelData } from "./xp-level-progress";
import { CommissionTracker, type CommissionTrackerData } from "./commission-tracker";
import {
  TrendingUp,
  UserCheck,
  ShoppingBag,
  Sparkles,
  Receipt,
} from "lucide-react";

export type StatisticsPageProps = {
  period: string;
  sales: SalesAnalyticsData;
  performance: SellerPerformanceData;
  buyer: BuyerAnalyticsData;
  xp: XPLevelData;
  commission: CommissionTrackerData;
};

const SECTIONS = [
  { id: "sales", icon: TrendingUp },
  { id: "performance", icon: UserCheck },
  { id: "buyer", icon: ShoppingBag },
  { id: "xp", icon: Sparkles },
  { id: "commission", icon: Receipt },
] as const;

export function StatisticsPage({ period, sales, performance, buyer, xp, commission }: StatisticsPageProps) {
  const t = useTranslations("dashboard.statistics");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function scrollTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const sectionLabels: Record<string, string> = {
    sales: t("salesAnalytics"),
    performance: t("sellerPerformance"),
    buyer: t("buyerAnalytics"),
    xp: t("xpProgress"),
    commission: t("commissionTracker"),
  };

  return (
    <div className="space-y-6">
      {/* Sticky control bar */}
      <div className="glass-subtle sticky top-0 z-10 -mx-1 rounded-xl p-4 space-y-3">
        {/* Period selector */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{t("periodLabel")}</p>
          <PeriodSelector current={period} />
        </div>

        {/* Section quick-nav */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SECTIONS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{sectionLabels[id]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <section ref={(el) => { sectionRefs.current.sales = el; }} className="scroll-mt-20">
        <h2 className="text-lg font-bold text-foreground mb-4">{t("salesAnalytics")}</h2>
        <SalesAnalytics data={sales} />
      </section>

      <section ref={(el) => { sectionRefs.current.performance = el; }} className="scroll-mt-20">
        <h2 className="text-lg font-bold text-foreground mb-4">{t("sellerPerformance")}</h2>
        <SellerPerformance data={performance} />
      </section>

      <section ref={(el) => { sectionRefs.current.buyer = el; }} className="scroll-mt-20">
        <h2 className="text-lg font-bold text-foreground mb-4">{t("buyerAnalytics")}</h2>
        <BuyerAnalytics data={buyer} />
      </section>

      <section ref={(el) => { sectionRefs.current.xp = el; }} className="scroll-mt-20">
        <h2 className="text-lg font-bold text-foreground mb-4">{t("xpProgress")}</h2>
        <XPLevelProgress data={xp} />
      </section>

      <section ref={(el) => { sectionRefs.current.commission = el; }} className="scroll-mt-20">
        <h2 className="text-lg font-bold text-foreground mb-4">{t("commissionTracker")}</h2>
        <CommissionTracker data={commission} />
      </section>
    </div>
  );
}
