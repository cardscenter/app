"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  MessageCircle,
  Bell,
  AlertTriangle,
  CreditCard,
  Package,
  XCircle,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import type { ActionItemsCounts } from "@/lib/dashboard-queries";

type Props = {
  counts: ActionItemsCounts;
  /** Fase 16-followup: false → optionele "stel 2FA in"-suggestie onderaan. */
  totpEnabled?: boolean;
};

type Item = {
  key: keyof ActionItemsCounts;
  count: number;
  href: string;
  icon: typeof MessageCircle;
  iconColor: string;
  bgColor: string;
};

export function ActionItemsWidget({ counts, totpEnabled = true }: Props) {
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

  return (
    <div className="glass-subtle rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">{t("title")}</h3>
      {allClear ? (
        <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 p-3">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm text-muted-foreground">{t("allClear")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-2 rounded-lg border border-border/50 p-3 transition-colors hover:border-border hover:bg-muted/30"
              >
                <div className={`rounded-lg ${item.bgColor} p-1.5`}>
                  <Icon className={`h-4 w-4 ${item.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">
                    {t(item.key)}
                  </p>
                  <p className="text-base font-bold text-foreground">{item.count}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Optionele 2FA-suggestie (Fase 16-followup) — bewust dashed/subtiel:
          geen urgent werk, maar wel de beste plek om 'm één keer te zien. */}
      {!totpEnabled && (
        <Link
          href="/dashboard/profiel"
          className="mt-3 flex items-center gap-2.5 rounded-lg border border-dashed border-border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/google_auth.webp" alt="" width={20} height={20} className="rounded" />
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">
            <span className="block font-medium text-foreground">{t("setup2fa")}</span>
            {t("setup2faDesc")}
          </span>
          <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {t("optional")}
          </span>
        </Link>
      )}
    </div>
  );
}
