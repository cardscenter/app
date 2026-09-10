"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Lock, Zap, TrendingUp, UserCheck, ShoppingBag, Sparkles, Receipt } from "lucide-react";

// Vaste dummy-bedragen: `Math.random()` gaf op server en client andere tekst
// → hydration-fout ("1 Issue" in de dev-overlay). De inhoud is toch geblurd.
const DUMMY_AMOUNTS = ["482,50", "1.240,00", "315,75"] as const;

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
    // Hoogte begrensd op het zichtbare scherm: de vijf dummy-secties zijn samen
    // ~1600px hoog en de absoluut-gecentreerde slot-kaart stond daardoor
    // buiten beeld. Nu valt het geblurde deel onder een fade en staat het slot
    // altijd in het viewport.
    <div className="relative max-h-[min(40rem,calc(100dvh-14rem))] min-h-[26rem] overflow-hidden rounded-dash">
      {/* Blurred dummy content */}
      <div className="pointer-events-none select-none blur-[6px]" aria-hidden>
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
                {DUMMY_AMOUNTS.map((amount) => (
                  <div key={amount} className="dash-card p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Metric</p>
                        <p className="text-xl font-bold">€{amount}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="dash-card p-5">
                <div className="h-48 bg-gradient-to-t from-primary/5 to-transparent rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fade naar de page-achtergrond zodat de afgekapte dummy niet hard eindigt */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent"
      />

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        <div className="dash-card p-6 text-center max-w-sm shadow-lg">
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
