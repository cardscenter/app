"use client";

import { useTranslations } from "next-intl";
import { PiggyBank, TrendingDown } from "lucide-react";
import { StatCard } from "./stat-card";

export type CommissionTrackerData = {
  commissionSaved: number;
  projectedAnnualSavings: number;
};

export function CommissionTracker({ data }: { data: CommissionTrackerData }) {
  const t = useTranslations("dashboard.statistics");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label={t("commissionSaved")}
          value={`€${data.commissionSaved.toFixed(2)}`}
          icon={PiggyBank}
          iconColor="text-green-600 dark:text-green-400"
          iconBg="bg-green-500/10"
        />
        <StatCard
          label={t("projectedSavings")}
          value={`€${data.projectedAnnualSavings.toFixed(2)}`}
          icon={TrendingDown}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
      </div>
    </div>
  );
}
