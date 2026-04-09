"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Truck, Clock, Star } from "lucide-react";
import { StatCard } from "./stat-card";

export type SellerPerformanceData = {
  avgShipDays: number;
  previousAvgShipDays: number;
  avgDeliveryDays: number;
  previousAvgDeliveryDays: number;
  overallRating: number;
  previousOverallRating: number;
  ratingsOverTime: { month: string; avgRating: number }[];
  ratingDistribution: { rating: number; count: number }[];
  subRatings: {
    packaging: number;
    shipping: number;
    communication: number;
  };
};

function comparison(current: number, previous: number) {
  if (previous === 0 && current === 0) return { change: 0, direction: "flat" as const };
  if (previous === 0) return { change: 100, direction: "up" as const };
  const change = Math.round(((current - previous) / previous) * 100);
  return { change: Math.abs(change), direction: change >= 0 ? "up" as const : "down" as const };
}

export function SellerPerformance({ data }: { data: SellerPerformanceData }) {
  const t = useTranslations("dashboard.statistics");

  const shipComp = comparison(data.avgShipDays, data.previousAvgShipDays);
  const deliveryComp = comparison(data.avgDeliveryDays, data.previousAvgDeliveryDays);
  const ratingComp = comparison(data.overallRating, data.previousOverallRating);

  const subRatingsData = [
    { name: t("packaging"), value: data.subRatings.packaging },
    { name: t("shipping"), value: data.subRatings.shipping },
    { name: t("communication"), value: data.subRatings.communication },
  ];

  const ratingColors: Record<number, string> = {
    1: "#ef4444",
    2: "#f97316",
    3: "#eab308",
    4: "#84cc16",
    5: "#22c55e",
  };

  const ratingDistWithColors = data.ratingDistribution.map((d) => ({
    ...d,
    fill: ratingColors[d.rating] ?? "#6b7280",
  }));

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("avgTimeToShip")}
          value={data.avgShipDays > 0 ? `${data.avgShipDays.toFixed(1)} ${t("days")}` : "-"}
          icon={Truck}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-500/10"
          comparison={{ ...shipComp, invert: true }}
        />
        <StatCard
          label={t("avgDeliveryTime")}
          value={data.avgDeliveryDays > 0 ? `${data.avgDeliveryDays.toFixed(1)} ${t("days")}` : "-"}
          icon={Clock}
          iconColor="text-amber-600 dark:text-amber-400"
          iconBg="bg-amber-500/10"
          comparison={{ ...deliveryComp, invert: true }}
        />
        <StatCard
          label={t("overallRating")}
          value={data.overallRating > 0 ? `${data.overallRating.toFixed(1)} / 5` : "-"}
          icon={Star}
          iconColor="text-yellow-600 dark:text-yellow-400"
          iconBg="bg-yellow-500/10"
          comparison={ratingComp}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Ratings over time - Line */}
        {data.ratingsOverTime.length > 1 && (
          <div className="glass-subtle rounded-xl p-5">
            <h4 className="text-sm font-semibold text-foreground mb-4">{t("ratingsOverTime")}</h4>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.ratingsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 5]}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: "0.75rem",
                      color: "var(--foreground)",
                    }}
                    formatter={(value) => [Number(value).toFixed(1), t("overallRating")]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgRating"
                    stroke="#eab308"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#eab308" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Rating distribution - Horizontal bar */}
        {data.ratingDistribution.some((d) => d.count > 0) && (
          <div className="glass-subtle rounded-xl p-5">
            <h4 className="text-sm font-semibold text-foreground mb-4">{t("ratingDistribution")}</h4>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ratingDistWithColors} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="rating"
                    type="category"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}★`}
                    width={35}
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
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Sub-ratings - Bar chart */}
      {subRatingsData.some((d) => d.value > 0) && (
        <div className="glass-subtle rounded-xl p-5">
          <h4 className="text-sm font-semibold text-foreground mb-4">{t("subRatings")}</h4>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={subRatingsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 5]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                  formatter={(value) => [Number(value).toFixed(1)]}
                />
                <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
