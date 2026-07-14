"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  MessageCircle,
  Bell,
  AlertTriangle,
  CreditCard,
  Gavel,
  Package,
  XCircle,
  CheckCircle2,
  MapPin,
  ChevronRight,
} from "lucide-react";
import type { ActionItemsCounts } from "@/lib/dashboard-queries";

type Props = {
  counts: ActionItemsCounts;
  /** Fase 16-followup: false → optionele "stel 2FA in"-suggestie onderaan. */
  totpEnabled?: boolean;
  /** Fase 43: false → "vul je verzendadres aan"-tegel onderaan (vangnet voor
   *  accounts van vóór het verplichte registratie-adres). */
  hasShippingAddress?: boolean;
};

type Item = {
  key: keyof ActionItemsCounts;
  count: number;
  href: string;
  icon: typeof MessageCircle;
  iconColor: string;
  bgColor: string;
};

export function ActionItemsWidget({
  counts,
  totpEnabled = true,
  hasShippingAddress = true,
}: Props) {
  const t = useTranslations("dashboard.essentials.actionItems");

  const items: Item[] = [
    {
      key: "unreadConversations",
      count: counts.unreadConversations,
      href: "/berichten",
      icon: MessageCircle,
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      key: "unreadNotifications",
      count: counts.unreadNotifications,
      href: "/dashboard/meldingen",
      icon: Bell,
      iconColor: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10",
    },
    {
      key: "openDisputes",
      count: counts.openDisputes,
      href: "/dashboard/geschillen",
      icon: AlertTriangle,
      iconColor: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-500/10",
    },
    {
      key: "awaitingPaymentAuctions",
      count: counts.awaitingPaymentAuctions,
      href: "/dashboard/aankopen",
      icon: CreditCard,
      iconColor: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-500/10",
    },
    {
      // Runner-up-aanbod: 72u-beslisvenster, dus tijdgevoeliger dan de
      // meeste andere tegels. Sectie met accept/decline staat op /aankopen.
      key: "runnerUpOffers",
      count: counts.runnerUpOffers,
      href: "/dashboard/aankopen",
      icon: Gavel,
      iconColor: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-500/10",
    },
    {
      key: "bundlesToShip",
      count: counts.bundlesToShip,
      href: "/dashboard/verkopen",
      icon: Package,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      key: "pendingCancellations",
      count: counts.pendingCancellations,
      href: "/dashboard/aankopen",
      icon: XCircle,
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      key: "pendingPickups",
      count: counts.pendingPickups,
      href: "/dashboard/aankopen",
      icon: MapPin,
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
    },
  ];

  const visibleItems = items.filter((i) => i.count > 0);
  const allClear = visibleItems.length === 0;
  const totalCount = visibleItems.reduce((s, i) => s + i.count, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
        {totalCount > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
            {totalCount}
          </span>
        )}
      </div>

      <div className="p-5">
        {allClear ? (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-500/5 p-4">
            <div className="rounded-xl bg-emerald-500/10 p-2.5">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm text-muted-foreground">{t("allClear")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl border border-border p-4 transition-all hover:bg-muted/30 hover:shadow-card-hover"
                >
                  <div className={`shrink-0 rounded-xl ${item.bgColor} p-2.5`}>
                    <Icon className={`h-5 w-5 ${item.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-bold leading-tight tabular-nums text-foreground">
                      {item.count}
                    </p>
                    <p className="text-sm text-muted-foreground">{t(item.key)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        )}

        {/* Verzendadres-vangnet (Fase 43) — voor accounts van vóór het
            verplichte registratie-adres. Amber pill: zonder adres kan er niet
            besteld of verzonden worden. */}
        {!hasShippingAddress && (
          <Link
            href="/dashboard/verzending"
            className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-amber-400/60 p-4 transition-colors hover:border-amber-500 hover:bg-amber-500/5 dark:border-amber-700/60"
          >
            <div className="rounded-xl bg-amber-500/10 p-2.5">
              <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">
              <span className="block font-medium text-foreground">{t("completeAddress")}</span>
              {t("completeAddressDesc")}
            </span>
            <span className="shrink-0 rounded-full border border-amber-300 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:text-amber-300">
              {t("requiredForOrders")}
            </span>
          </Link>
        )}

        {/* 2FA-suggestie (Fase 16-followup) — dashed tegel met zwevend
            "Aanbevolen"-label bovenaan-midden (Fase 44-feedback). */}
        {!totpEnabled && (
          <Link
            href="/dashboard/profiel"
            className="relative mt-6 flex items-center gap-3 rounded-xl border border-dashed border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
          >
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary backdrop-blur-sm">
              {t("recommended")}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/google_auth.webp" alt="" width={36} height={36} className="shrink-0 rounded-lg" />
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">
              <span className="block font-medium text-foreground">{t("setup2fa")}</span>
              {t("setup2faDesc")}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )}
      </div>
    </div>
  );
}
