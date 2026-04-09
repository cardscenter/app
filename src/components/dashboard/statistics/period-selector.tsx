"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const PERIODS = ["30d", "90d", "1y", "all"] as const;

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
    "30d": t("period30d"),
    "90d": t("period90d"),
    "1y": t("period1y"),
    all: t("periodAll"),
  };

  return (
    <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
      {PERIODS.map((period) => (
        <button
          key={period}
          onClick={() => handlePeriodChange(period)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
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
