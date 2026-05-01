"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Inbox } from "lucide-react";
import type { RecentBundles, BundleRow } from "@/lib/dashboard-queries";

type Props = { data: RecentBundles };

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  SHIPPED: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  COMPLETED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  CANCELLED: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  DISPUTED: "bg-red-500/10 text-red-700 dark:text-red-300",
};

function BundleList({
  bundles,
  emptyText,
  perspective,
  counterpartyLabel,
}: {
  bundles: BundleRow[];
  emptyText: string;
  perspective: "sales" | "purchases";
  counterpartyLabel: string;
}) {
  if (bundles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-4 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {bundles.map((b) => (
        <li key={b.id}>
          <Link
            href={perspective === "sales" ? `/dashboard/verkopen` : `/dashboard/aankopen`}
            className="block rounded-lg border border-border/50 p-2.5 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="truncate text-sm font-medium text-foreground">
                {b.itemTitle ?? b.orderNumber}
              </p>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                  STATUS_COLORS[b.status] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {b.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">
                {counterpartyLabel}: {b.counterpartyName}
              </span>
              <span className="shrink-0 font-medium">€{b.totalCost.toFixed(2)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RecentBundlesWidget({ data }: Props) {
  const t = useTranslations("dashboard.essentials.bundles");

  return (
    <div className="glass-subtle rounded-xl p-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">{t("salesTitle")}</h3>
          <BundleList
            bundles={data.sales}
            emptyText={t("emptySales")}
            perspective="sales"
            counterpartyLabel={t("buyer")}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">{t("purchasesTitle")}</h3>
          <BundleList
            bundles={data.purchases}
            emptyText={t("emptyPurchases")}
            perspective="purchases"
            counterpartyLabel={t("seller")}
          />
        </div>
      </div>
    </div>
  );
}
