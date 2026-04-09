"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { SELLER_LEVELS, type XPBreakdown } from "@/lib/seller-levels";

export type XPLevelData = {
  xp: XPBreakdown;
  currentLevel: { name: string; icon: string; color: string; minXP: number };
  nextLevel: { name: string; minXP: number } | null;
  progress: number;
};

const SOURCE_COLORS: Record<string, string> = {
  accountAge: "#6b7280",
  sales: "#22c55e",
  purchases: "#3b82f6",
  positiveReviews: "#eab308",
  reviewsGiven: "#8b5cf6",
  completedTransactions: "#f59e0b",
};

export function XPLevelProgress({ data }: { data: XPLevelData }) {
  const t = useTranslations("dashboard.statistics");

  const xpSources = [
    { source: t("xpAccountAge"), xp: data.xp.accountAge, key: "accountAge", fill: SOURCE_COLORS["accountAge"] },
    { source: t("xpSales"), xp: data.xp.sales, key: "sales", fill: SOURCE_COLORS["sales"] },
    { source: t("xpPurchases"), xp: data.xp.purchases, key: "purchases", fill: SOURCE_COLORS["purchases"] },
    { source: t("xpReviewsReceived"), xp: data.xp.positiveReviews, key: "positiveReviews", fill: SOURCE_COLORS["positiveReviews"] },
    { source: t("xpReviewsGiven"), xp: data.xp.reviewsGiven, key: "reviewsGiven", fill: SOURCE_COLORS["reviewsGiven"] },
    { source: t("xpTransactions"), xp: data.xp.completedTransactions, key: "completedTransactions", fill: SOURCE_COLORS["completedTransactions"] },
  ].filter((s) => s.xp > 0);

  return (
    <div className="space-y-5">
      {/* Level progress card */}
      <div className="glass-subtle rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{data.currentLevel.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className={`text-sm font-bold ${data.currentLevel.color}`}>
                {data.currentLevel.name}
              </h4>
              <span className="text-xs text-muted-foreground font-medium">
                {data.xp.total.toLocaleString()} XP
              </span>
            </div>
            {data.nextLevel && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("xpToNext", {
                  xp: (data.nextLevel.minXP - data.xp.total).toLocaleString(),
                  level: data.nextLevel.name,
                })}
              </p>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${data.progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">
            {data.currentLevel.minXP.toLocaleString()} XP
          </span>
          {data.nextLevel && (
            <span className="text-[10px] text-muted-foreground">
              {data.nextLevel.minXP.toLocaleString()} XP
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* XP by source - Horizontal bar */}
        {xpSources.length > 0 && (
          <div className="glass-subtle rounded-xl p-5">
            <h4 className="text-sm font-semibold text-foreground mb-4">{t("xpBreakdown")}</h4>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={xpSources} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="source"
                    type="category"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: "0.75rem",
                      color: "var(--foreground)",
                    }}
                    formatter={(value) => [`${Number(value).toLocaleString()} XP`]}
                  />
                  <Bar dataKey="xp" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Level timeline */}
        <div className="glass-subtle rounded-xl p-5">
          <h4 className="text-sm font-semibold text-foreground mb-4">{t("levelProgress")}</h4>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {SELLER_LEVELS.map((level) => {
              const isReached = data.xp.total >= level.minXP;
              const isCurrent = level.name === data.currentLevel.name;
              return (
                <div
                  key={level.nameKey}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    isCurrent
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : isReached
                        ? "opacity-80"
                        : "opacity-40"
                  }`}
                >
                  <span className="text-sm">{level.icon}</span>
                  <span className={`font-medium flex-1 ${isCurrent ? level.color : isReached ? "text-foreground" : "text-muted-foreground"}`}>
                    {level.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {level.minXP.toLocaleString()} XP
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
