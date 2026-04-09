"use client";

import { useTranslations } from "next-intl";
import { EscrowInfoButton, InfoPopup } from "@/components/ui/info-tooltip";
import { Wallet, Lock, Landmark, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

interface BalanceSummaryProps {
  balance: number;
  reservedBalance: number;
  heldBalance: number;
}

export function BalanceSummary({ balance, reservedBalance, heldBalance }: BalanceSummaryProps) {
  const t = useTranslations("wallet");
  const availableBalance = Math.max(0, balance - reservedBalance);

  const cards: {
    label: string;
    value: number;
    icon: typeof Wallet;
    iconColor: string;
    iconBg: string;
    info: ReactNode;
  }[] = [
    {
      label: t("availableBalance"),
      value: availableBalance,
      icon: Wallet,
      iconColor: "text-green-600 dark:text-green-400",
      iconBg: "bg-green-500/10",
      info: <InfoPopup title={t("availableBalance")} text={t("availableBalanceHint")} />,
    },
    {
      label: t("reservedBalance"),
      value: reservedBalance,
      icon: Lock,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-500/10",
      info: <InfoPopup title={t("reservedBalance")} text={t("reservedBalanceHint")} />,
    },
    {
      label: t("totalBalance"),
      value: balance,
      icon: Landmark,
      iconColor: "text-muted-foreground",
      iconBg: "bg-muted",
      info: <InfoPopup title={t("totalBalance")} text={t("totalBalanceHint")} />,
    },
    {
      label: t("heldBalance"),
      value: heldBalance,
      icon: ShieldCheck,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10",
      info: <EscrowInfoButton />,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="glass rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className={`shrink-0 rounded-lg p-1.5 ${card.iconBg}`}>
                <Icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground leading-tight">
                {card.label}
                {card.info}
              </p>
            </div>
            <p className="mt-3 text-3xl font-bold text-foreground">
              &euro;{card.value.toFixed(2)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
