"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const PERIODS = ["month", "30d", "90d", "ytd", "1y", "all"] as const;

interface PeriodSelectorProps {
  current: string;
}

export function PeriodSelector({ current }: PeriodSelectorProps) {
  const t = useTranslations("dashboard.statistics");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handlePeriodChange(period: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`${pathname}?${params.toString()}`);
  }

  const labels: Record<string, string> = {
    month: t("periodMonth"),
    "30d": t("period30d"),
    "90d": t("period90d"),
    ytd: t("periodYtd"),
    "1y": t("period1y"),
    all: t("periodAll"),
  };

  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
      {PERIODS.map((period) => (
        <button
          key={period}
          onClick={() => handlePeriodChange(period)}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3 ${
            current === period
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {labels[period]}
        </button>
      ))}
    </div>
  );
}
