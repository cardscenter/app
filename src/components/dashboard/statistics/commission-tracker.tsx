"use client";

import { useTranslations } from "next-intl";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Receipt, PiggyBank, TrendingDown } from "lucide-react";
import { StatCard } from "./stat-card";

export type CommissionTrackerData = {
  totalCommissionPaid: number;
  previousCommissionPaid: number;
  commissionSaved: number;
  projectedAnnualSavings: number;
  commissionOverTime: { month: string; total: number }[];
};

function comparison(current: number, previous: number) {
  if (previous === 0 && current === 0) return { change: 0, direction: "flat" as const };
  if (previous === 0) return { change: 100, direction: "up" as const };
  const change = Math.round(((current - previous) / previous) * 100);
  return { change: Math.abs(change), direction: change >= 0 ? "up" as const : "down" as const };
}

export function CommissionTracker({ data }: { data: CommissionTrackerData }) {
  const t = useTranslations("dashboard.statistics");

  const commissionComp = comparison(data.totalCommissionPaid, data.previousCommissionPaid);

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("commissionPaid")}
          value={`€${data.totalCommissionPaid.toFixed(2)}`}
          icon={Receipt}
          iconColor="text-red-600 dark:text-red-400"
          iconBg="bg-red-500/10"
          comparison={{ ...commissionComp, invert: true }}
        />
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

      {/* Commission over time - Area chart */}
      {data.commissionOverTime.length > 1 && (
        <div className="glass-subtle rounded-xl p-5">
          <h4 className="text-sm font-semibold text-foreground mb-4">{t("commissionOverTime")}</h4>
          <div style={{ width: "100%", height: 192 }}>
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={data.commissionOverTime}>
                <defs>
                  <linearGradient id="commissionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `€${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                    color: "var(--foreground)",
                  }}
                  formatter={(value) => [`€${Number(value).toFixed(2)}`, t("commissionPaid")]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#commissionGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
