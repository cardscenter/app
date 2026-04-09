"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ShoppingBag, Package } from "lucide-react";
import { StatCard } from "./stat-card";

export type BuyerAnalyticsData = {
  totalSpent: number;
  previousTotalSpent: number;
  itemsPurchased: number;
  previousItemsPurchased: number;
  spendingByType: { name: string; value: number }[];
  purchaseFrequency: { month: string; count: number }[];
};

const TYPE_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b"];

function addFills<T>(data: T[]): (T & { fill: string })[] {
  return data.map((d, i) => ({ ...d, fill: TYPE_COLORS[i % TYPE_COLORS.length] }));
}

function comparison(current: number, previous: number) {
  if (previous === 0 && current === 0) return { change: 0, direction: "flat" as const };
  if (previous === 0) return { change: 100, direction: "up" as const };
  const change = Math.round(((current - previous) / previous) * 100);
  return { change: Math.abs(change), direction: change >= 0 ? "up" as const : "down" as const };
}

export function BuyerAnalytics({ data }: { data: BuyerAnalyticsData }) {
  const t = useTranslations("dashboard.statistics");

  const spentComp = comparison(data.totalSpent, data.previousTotalSpent);
  const itemsComp = comparison(data.itemsPurchased, data.previousItemsPurchased);

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label={t("totalSpent")}
          value={`€${data.totalSpent.toFixed(2)}`}
          icon={ShoppingBag}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-500/10"
          comparison={spentComp}
        />
        <StatCard
          label={t("itemsPurchased")}
          value={String(data.itemsPurchased)}
          icon={Package}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-500/10"
          comparison={itemsComp}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Spending by type - Donut */}
        {data.spendingByType.some((d) => d.value > 0) && (
          <div className="glass-subtle rounded-xl p-5">
            <h4 className="text-sm font-semibold text-foreground mb-4">{t("spendingByType")}</h4>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={addFills(data.spendingByType)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: "0.75rem",
                      color: "var(--foreground)",
                    }}
                    formatter={(value) => [`€${Number(value).toFixed(2)}`]}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.75rem", color: "var(--foreground)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Purchase frequency - Bar */}
        {data.purchaseFrequency.length > 0 && (
          <div className="glass-subtle rounded-xl p-5">
            <h4 className="text-sm font-semibold text-foreground mb-4">{t("purchaseFrequency")}</h4>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.purchaseFrequency}>
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
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: "0.75rem",
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
