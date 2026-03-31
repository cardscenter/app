"use client";

import { useTranslations } from "next-intl";

interface BalanceSummaryProps {
  balance: number;
  reservedBalance: number;
  heldBalance: number;
}

export function BalanceSummary({ balance, reservedBalance, heldBalance }: BalanceSummaryProps) {
  const t = useTranslations("wallet");
  const availableBalance = Math.max(0, balance - reservedBalance);

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Available balance */}
      <div className="glass rounded-2xl p-4">
        <p className="text-sm text-muted-foreground">{t("availableBalance")}</p>
        <p className="mt-1 text-3xl font-bold text-foreground">
          &euro;{availableBalance.toFixed(2)}
        </p>
      </div>

      {/* Reserved for bids */}
      {reservedBalance > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/10">
          <p className="text-sm text-blue-600 dark:text-blue-400">{t("reservedBalance")}</p>
          <p className="mt-1 text-3xl font-bold text-blue-700 dark:text-blue-300">
            &euro;{reservedBalance.toFixed(2)}
          </p>
        </div>
      )}

      {/* Total balance */}
      <div className="glass rounded-2xl p-4">
        <p className="text-sm text-muted-foreground">{t("totalBalance")}</p>
        <p className="mt-1 text-3xl font-bold text-foreground">
          &euro;{balance.toFixed(2)}
        </p>
      </div>

      {/* Held in escrow (for sellers) */}
      {heldBalance > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
          <p className="text-sm text-amber-600 dark:text-amber-400">{t("heldBalance")}</p>
          <p className="mt-1 text-3xl font-bold text-amber-700 dark:text-amber-300">
            &euro;{heldBalance.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
