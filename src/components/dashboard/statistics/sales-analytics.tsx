"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, Package, Receipt } from "lucide-react";
import { StatCard } from "./stat-card";

export type SalesAnalyticsData = {
  totalRevenue: number;
  previousTotalRevenue: number;
  itemsSold: number;
  previousItemsSold: number;
  avgSalePrice: number;
  previousAvgSalePrice: number;
  revenueByType: { name: string; value: number }[];
  revenuePerMonth: { month: string; revenue: number }[];
  avgPricePerMonth: { month: string; avgPrice: number }[];
};

const TYPE_COLORS = ["var(--primary)", "#10b981", "#f59e0b"];

function addFills<T>(data: T[]): (T & { fill: string })[] {
  return data.map((d, i) => ({ ...d, fill: TYPE_COLORS[i % TYPE_COLORS.length] }));
}

function comparison(current: number, previous: number) {
  if (previous === 0 && current === 0) return { change: 0, direction: "flat" as const };
  if (previous === 0) return { change: 100, direction: "up" as const };
  const change = Math.round(((current - previous) / previous) * 100);
  return { change: Math.abs(change), direction: change >= 0 ? "up" as const : "down" as const };
}

export function SalesAnalytics({ data }: { data: SalesAnalyticsData }) {
  const t = useTranslations("dashboard.statistics");

  const revenueComp = comparison(data.totalRevenue, data.previousTotalRevenue);
  const itemsComp = comparison(data.itemsSold, data.previousItemsSold);
  const avgComp = comparison(data.avgSalePrice, data.previousAvgSalePrice);

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("totalRevenue")}
          value={`€${data.totalRevenue.toFixed(2)}`}
          icon={TrendingUp}
          iconColor="text-green-600 dark:text-green-400"
          iconBg="bg-green-500/10"
          comparison={revenueComp}
        />
        <StatCard
          label={t("itemsSold")}
          value={String(data.itemsSold)}
          icon={Package}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-500/10"
          comparison={itemsComp}
        />
        <StatCard
          label={t("avgSalePrice")}
          value={`€${data.avgSalePrice.toFixed(2)}`}
          icon={Receipt}
          iconColor="text-purple-600 dark:text-purple-400"
          iconBg="bg-purple-500/10"
          comparison={avgComp}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue by type - Donut */}
        {data.revenueByType.some((d) => d.value > 0) && (
          <div className="glass-subtle rounded-xl p-5">
            <h4 className="text-sm font-semibold text-foreground mb-4">{t("revenueByType")}</h4>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={addFills(data.revenueByType)}
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
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "0.75rem", color: "var(--foreground)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Revenue per month - Bar */}
        {data.revenuePerMonth.length > 0 && (
          <div className="glass-subtle rounded-xl p-5">
            <h4 className="text-sm font-semibold text-foreground mb-4">{t("revenuePerMonth")}</h4>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.revenuePerMonth}>
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
                    formatter={(value) => [`€${Number(value).toFixed(2)}`, t("revenue")]}
                  />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Average price over time - Line */}
      {data.avgPricePerMonth.length > 1 && (
        <div className="glass-subtle rounded-xl p-5">
          <h4 className="text-sm font-semibold text-foreground mb-4">{t("avgPriceOverTime")}</h4>
          <div style={{ width: "100%", height: 192 }}>
            <ResponsiveContainer width="100%" height={192}>
              <LineChart data={data.avgPricePerMonth}>
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
                  }}
                  formatter={(value) => [`€${Number(value).toFixed(2)}`, t("avgSalePrice")]}
                />
                <Line
                  type="monotone"
                  dataKey="avgPrice"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#8b5cf6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
