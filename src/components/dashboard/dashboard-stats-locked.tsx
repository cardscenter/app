"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Lock,
  TrendingUp,
  Clock,
  MessageCircle,
  Star,
  Gavel,
  Tag,
  Store,
  Wallet,
  Zap,
} from "lucide-react";

export function DashboardStatsLocked() {
  const t = useTranslations("dashboard");

  return (
    <div className="relative">
      {/* Blurred dummy content */}
      <div className="pointer-events-none select-none blur-[6px]">
        <div className="space-y-6">
          {/* Revenue row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="glass-subtle rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("stats.totalRevenue")}</p>
                  <p className="text-xl font-bold">€1.234,56</p>
                </div>
              </div>
            </div>
            <div className="glass-subtle rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Wallet className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("stats.thisMonth")}</p>
                  <p className="text-xl font-bold">€456,78</p>
                </div>
              </div>
            </div>
            <div className="glass-subtle rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("stats.inEscrow")}</p>
                  <p className="text-xl font-bold">€89,00</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active + Recent row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="glass-subtle rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">{t("stats.activeItems")}</h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Gavel className="h-4 w-4" /> {t("stats.auctionsEndingSoon")}
                  </div>
                  <span className="text-sm font-semibold">3</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Tag className="h-4 w-4" /> {t("stats.activeClaimsales")}
                  </div>
                  <span className="text-sm font-semibold">5</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Store className="h-4 w-4" /> {t("stats.activeListings")}
                  </div>
                  <span className="text-sm font-semibold">12</span>
                </div>
              </div>
            </div>
            <div className="glass-subtle rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">{t("stats.recentActivity")}</h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Gavel className="h-4 w-4" /> {t("stats.newBids")}
                  </div>
                  <span className="text-sm font-semibold">8</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="h-4 w-4" /> {t("stats.newMessages")}
                  </div>
                  <span className="text-sm font-semibold">4</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4" /> {t("stats.newReviews")}
                  </div>
                  <span className="text-sm font-semibold">2</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fake chart area */}
          <div className="glass-subtle rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">{t("stats.revenueChart")}</h3>
            <div className="h-48 bg-gradient-to-t from-primary/5 to-transparent rounded-lg" />
          </div>
        </div>
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="glass rounded-2xl p-8 text-center max-w-sm shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">
            {t("stats.locked")}
          </h3>
          <p className="text-sm text-muted-foreground mb-5">
            {t("stats.lockedDescription")}
          </p>
          <Link
            href="/dashboard/abonnement"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Zap className="h-4 w-4" />
            {t("stats.upgradeCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
