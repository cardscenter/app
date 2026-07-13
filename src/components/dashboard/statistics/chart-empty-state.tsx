"use client";

import { useTranslations } from "next-intl";
import { Inbox } from "lucide-react";

type Props = {
  title: string;
  messageKey:
    | "noSales"
    | "noPurchases"
    | "noReviews"
    | "noRatings"
    | "noCommission"
    | "noTrend";
  height?: number;
};

export function ChartEmptyState({ title, messageKey, height = 220 }: Props) {
  const t = useTranslations("dashboard.statistics.empty");

  return (
    <div className="border border-border bg-card shadow-card rounded-xl p-5">
      <h4 className="text-sm font-semibold text-foreground mb-4">{title}</h4>
      <div
        className="flex flex-col items-center justify-center gap-2 text-center"
        style={{ height }}
      >
        <Inbox className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t(messageKey)}</p>
      </div>
    </div>
  );
}
