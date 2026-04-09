"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Lock, Zap, TrendingUp, UserCheck, ShoppingBag, Sparkles, Receipt } from "lucide-react";

export function StatisticsLocked() {
  const t = useTranslations("dashboard.statistics");

  const dummySections = [
    { icon: TrendingUp, label: t("salesAnalytics") },
    { icon: UserCheck, label: t("sellerPerformance") },
    { icon: ShoppingBag, label: t("buyerAnalytics") },
    { icon: Sparkles, label: t("xpProgress") },
    { icon: Receipt, label: t("commissionTracker") },
  ];

  return (
    <div className="relative">
      {/* Blurred dummy content */}
      <div className="pointer-events-none select-none blur-[6px]">
        <div className="space-y-6">
          {/* Fake period selector */}
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
            {["30d", "90d", "1y", "All"].map((p) => (
              <div key={p} className="rounded-md px-3 py-1.5 text-xs font-medium bg-background shadow-sm">
                {p}
              </div>
            ))}
          </div>

          {/* Fake sections */}
          {dummySections.map(({ icon: Icon, label }) => (
            <div key={label} className="space-y-4">
              <h2 className="text-lg font-bold">{label}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass-subtle rounded-xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Metric</p>
                        <p className="text-xl font-bold">€{(Math.random() * 1000).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="glass-subtle rounded-xl p-5">
                <div className="h-48 bg-gradient-to-t from-primary/5 to-transparent rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="glass rounded-2xl p-8 text-center max-w-sm shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">
            {t("locked")}
          </h3>
          <p className="text-sm text-muted-foreground mb-5">
            {t("lockedDescription")}
          </p>
          <Link
            href="/dashboard/abonnement"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Zap className="h-4 w-4" />
            {t("upgradeCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
