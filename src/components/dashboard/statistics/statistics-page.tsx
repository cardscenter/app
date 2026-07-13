"use client";

import { useTranslations } from "next-intl";
import { PeriodSelector } from "./period-selector";
import { ExportCsvButton } from "./export-csv-button";
import { SalesAnalytics, type SalesAnalyticsData } from "./sales-analytics";
import { SellerPerformance, type SellerPerformanceData } from "./seller-performance";
import { BuyerAnalytics, type BuyerAnalyticsData } from "./buyer-analytics";
import { CommissionTracker, type CommissionTrackerData } from "./commission-tracker";

export type StatisticsPageProps = {
  period: string;
  sales: SalesAnalyticsData;
  performance: SellerPerformanceData;
  buyer: BuyerAnalyticsData;
  commission: CommissionTrackerData;
};

// Fase 44: sectie-quick-nav en XP-sectie zijn vervallen — alleen de slanke
// periode-balk blijft sticky. XP/level leeft op /dashboard/level.
export function StatisticsPage({ period, sales, performance, buyer, commission }: StatisticsPageProps) {
  const t = useTranslations("dashboard.statistics");

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Sticky periode-balk */}
      <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-card backdrop-blur-sm">
        <p className="text-sm font-medium text-muted-foreground">{t("periodLabel")}</p>
        <PeriodSelector current={period} />
      </div>

      {/* Sections */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-foreground">{t("salesAnalytics")}</h2>
          <ExportCsvButton section="sales" period={period} />
        </div>
        <SalesAnalytics data={sales} />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-foreground">{t("sellerPerformance")}</h2>
          <ExportCsvButton section="performance" period={period} />
        </div>
        <SellerPerformance data={performance} />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-foreground">{t("buyerAnalytics")}</h2>
          <ExportCsvButton section="buyer" period={period} />
        </div>
        <BuyerAnalytics data={buyer} />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-foreground">{t("commissionTracker")}</h2>
          <ExportCsvButton section="commission" period={period} />
        </div>
        <CommissionTracker data={commission} />
      </section>
    </div>
  );
}
