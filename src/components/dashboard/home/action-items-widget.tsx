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
import { useFeature } from "@/components/providers/feature-flags-provider";
import { TONE_ICON, type DashTone } from "@/components/dashboard/ui/tones";
import { cn } from "@/lib/utils";

type Props = {
  counts: ActionItemsCounts;
  /** Fase 16-followup: false → optionele "stel 2FA in"-suggestie onderaan. */
  totpEnabled?: boolean;
  /** Fase 43: false → "vul je verzendadres aan"-tegel onderaan (vangnet voor
   *  accounts van vóór het verplichte registratie-adres). */
  hasShippingAddress?: boolean;
  /** "list" = compacte rijen (voor een smalle kolom), "grid" = tegels (default). */
  layout?: "grid" | "list";
};

type Item = {
  key: keyof ActionItemsCounts;
  count: number;
  href: string;
  icon: typeof MessageCircle;
  tone: DashTone;
};

export function ActionItemsWidget({
  counts,
  totpEnabled = true,
  hasShippingAddress = true,
  layout = "grid",
}: Props) {
  const isList = layout === "list";
  const t = useTranslations("dashboard.essentials.actionItems");
  // Verzendadres-tegel hoort bij bestellen/verzenden (saldo-model).
  const walletOn = useFeature("FEATURE_WALLET");

  const items: Item[] = [
    {
      key: "unreadConversations",
      count: counts.unreadConversations,
      href: "/berichten",
      icon: MessageCircle,
      tone: "blue",
    },
    {
      key: "unreadNotifications",
      count: counts.unreadNotifications,
      href: "/dashboard/meldingen",
      icon: Bell,
      tone: "yellow",
    },
    {
      key: "openDisputes",
      count: counts.openDisputes,
      href: "/dashboard/geschillen",
      icon: AlertTriangle,
      tone: "pink",
    },
    {
      key: "awaitingPaymentAuctions",
      count: counts.awaitingPaymentAuctions,
      href: "/dashboard/aankopen",
      icon: CreditCard,
      tone: "yellow",
    },
    {
      // Runner-up-aanbod: 72u-beslisvenster, dus tijdgevoeliger dan de
      // meeste andere tegels. Sectie met accept/decline staat op /aankopen.
      key: "runnerUpOffers",
      count: counts.runnerUpOffers,
      href: "/dashboard/aankopen",
      icon: Gavel,
      tone: "blue",
    },
    {
      key: "bundlesToShip",
      count: counts.bundlesToShip,
      href: "/dashboard/verkopen",
      icon: Package,
      tone: "green",
    },
    {
      key: "pendingCancellations",
      count: counts.pendingCancellations,
      href: "/dashboard/aankopen",
      icon: XCircle,
      tone: "pink",
    },
    {
      key: "pendingPickups",
      count: counts.pendingPickups,
      href: "/dashboard/aankopen",
      icon: MapPin,
      tone: "blue",
    },
  ];

  const visibleItems = items.filter((i) => i.count > 0);
  const allClear = visibleItems.length === 0;
  const totalCount = visibleItems.reduce((s, i) => s + i.count, 0);

  return (
    <div className="overflow-hidden dash-card">
      <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">{t("title")}</h2>
        {totalCount > 0 && (
          <span className="cc-pill cc-grad px-2 py-0.5 text-xs font-semibold tabular-nums">{totalCount}</span>
        )}
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        {allClear ? (
          <div className="flex items-center gap-3 rounded-[14px] bg-[var(--pastel-green)] px-4 py-3 text-[var(--pastel-green-ink)]">
            <CheckCircle2 className="size-5 shrink-0" />
            <p className="text-sm font-medium">{t("allClear")}</p>
          </div>
        ) : (
          <div className={isList ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-[14px] bg-[var(--background)] transition-colors hover:bg-[var(--muted)]",
                    isList ? "p-2.5" : "p-4",
                  )}
                >
                  <div className={cn("flex shrink-0 items-center justify-center rounded-full", TONE_ICON[item.tone], isList ? "size-8" : "size-10")}>
                    <Icon className={isList ? "size-4" : "size-[18px]"} />
                  </div>
                  {isList ? (
                    <>
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{t(item.key)}</p>
                      <span className="cc-pill shrink-0 bg-[var(--foreground)] px-2 py-0.5 text-xs font-bold tabular-nums text-white">
                        {item.count}
                      </span>
                    </>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="cc-display text-3xl tabular-nums text-foreground">
                        {item.count}
                      </p>
                      <p className="text-sm text-muted-foreground">{t(item.key)}</p>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        )}

        {/* Verzendadres-vangnet (Fase 43) — voor accounts van vóór het
            verplichte registratie-adres. Amber pill: zonder adres kan er niet
            besteld of verzonden worden. */}
        {walletOn && !hasShippingAddress && (
          <Link
            href="/dashboard/verzending"
            className="mt-4 flex items-center gap-3 rounded-[14px] bg-[var(--pastel-yellow)] p-3 text-[var(--pastel-yellow-ink)] transition-[filter] hover:brightness-[1.03]"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/70">
              <MapPin className="size-[18px]" />
            </div>
            <span className="min-w-0 flex-1 text-sm opacity-85">
              <span className="block font-semibold opacity-100">{t("completeAddress")}</span>
              {t("completeAddressDesc")}
            </span>
            <span className="cc-pill shrink-0 bg-white px-2.5 py-1 text-[10px] font-semibold leading-none">{t("requiredForOrders")}</span>
          </Link>
        )}

        {/* 2FA-suggestie (Fase 16-followup) — dashed tegel met zwevend
            "Aanbevolen"-label bovenaan-midden (Fase 44-feedback). */}
        {!totpEnabled && (
          <Link
            href="/dashboard/profiel"
            className="relative mt-5 flex items-center gap-3 rounded-[14px] border-2 border-dashed border-border p-3 transition-colors hover:border-foreground/30 hover:bg-[var(--background)]"
          >
            <span className="cc-pill absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[var(--pastel-blue)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--pastel-blue-ink)]">
              {t("recommended")}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/google_auth.webp" alt="" width={36} height={36} className="shrink-0 rounded-[10px]" />
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
