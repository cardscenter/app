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
import {
  TrendingUp,
  Clock,
  MessageCircle,
  Star,
  Gavel,
  Tag,
  Store,
  Wallet,
} from "lucide-react";

type DashboardStatsProps = {
  revenue: {
    total: number;
    thisMonth: number;
    inEscrow: number;
  };
  activeItems: {
    auctionsEndingSoon: number;
    activeClaimsales: number;
    activeListings: number;
  };
  recentActivity: {
    newBids: number;
    newMessages: number;
    newReviews: number;
  };
  chartData: { date: string; revenue: number }[];
};

export function DashboardStats({
  revenue,
  activeItems,
  recentActivity,
  chartData,
}: DashboardStatsProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      {/* Revenue Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-subtle rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("stats.totalRevenue")}</p>
              <p className="text-xl font-bold text-foreground">€{revenue.total.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="glass-subtle rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("stats.thisMonth")}</p>
              <p className="text-xl font-bold text-foreground">€{revenue.thisMonth.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="glass-subtle rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("stats.inEscrow")}</p>
              <p className="text-xl font-bold text-foreground">€{revenue.inEscrow.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Items + Recent Activity */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Active Items */}
        <div className="glass-subtle rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t("stats.activeItems")}</h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gavel className="h-4 w-4" />
                {t("stats.auctionsEndingSoon")}
              </div>
              <span className="text-sm font-semibold text-foreground">{activeItems.auctionsEndingSoon}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="h-4 w-4" />
                {t("stats.activeClaimsales")}
              </div>
              <span className="text-sm font-semibold text-foreground">{activeItems.activeClaimsales}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Store className="h-4 w-4" />
                {t("stats.activeListings")}
              </div>
              <span className="text-sm font-semibold text-foreground">{activeItems.activeListings}</span>
            </div>
          </div>
        </div>

        {/* Recent Activity (7 days) */}
        <div className="glass-subtle rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t("stats.recentActivity")}</h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gavel className="h-4 w-4" />
                {t("stats.newBids")}
              </div>
              <span className="text-sm font-semibold text-foreground">{recentActivity.newBids}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                {t("stats.newMessages")}
              </div>
              <span className="text-sm font-semibold text-foreground">{recentActivity.newMessages}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4" />
                {t("stats.newReviews")}
              </div>
              <span className="text-sm font-semibold text-foreground">{recentActivity.newReviews}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Revenue Chart */}
      {chartData.length > 0 && (
        <div className="glass-subtle rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t("stats.revenueChart")}</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `€${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                  formatter={(value) => [`€${Number(value).toFixed(2)}`, t("stats.revenue")]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
