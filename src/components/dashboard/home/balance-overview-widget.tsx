"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Wallet, Lock, Shield, ArrowRight } from "lucide-react";
import type { BalanceOverview } from "@/lib/dashboard-queries";

type Props = { data: BalanceOverview };

export function BalanceOverviewWidget({ data }: Props) {
  const t = useTranslations("dashboard.essentials.balance");

  return (
    <div className="glass-subtle rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        <Link
          href="/dashboard/saldo"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          {t("viewAll")} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg border border-border/50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Wallet className="h-3.5 w-3.5" />
            {t("available")}
          </div>
          <p className="text-base font-bold text-foreground">€{data.available.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border/50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Lock className="h-3.5 w-3.5" />
            {t("reserved")}
          </div>
          <p className="text-base font-bold text-foreground">€{data.reserved.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border/50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Shield className="h-3.5 w-3.5" />
            {t("escrow")}
          </div>
          <p className="text-base font-bold text-foreground">€{data.escrow.toFixed(2)}</p>
        </div>
      </div>

      {data.recentTransactions.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {t("recentTransactions")}
          </p>
          <ul className="space-y-1.5">
            {data.recentTransactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    tx.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {tx.amount >= 0 ? "+" : ""}€{tx.amount.toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
