"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";

// Fase 44: dropdown i.p.v. pill-rij — negen periodes van vandaag t/m alles.
const PERIODS = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "90d",
  "ytd",
  "1y",
  "prevyear",
  "all",
] as const;

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
    today: t("periodToday"),
    yesterday: t("periodYesterday"),
    "7d": t("period7d"),
    "30d": t("period30d"),
    "90d": t("period90d"),
    ytd: t("periodYtd"),
    "1y": t("period1y"),
    prevyear: t("periodPrevYear"),
    all: t("periodAll"),
  };

  // Legacy deep-links (?period=month) blijven werken: toon 'm dan als extra optie.
  const options: string[] = PERIODS.includes(current as (typeof PERIODS)[number])
    ? [...PERIODS]
    : [current, ...PERIODS];

  return (
    <div className="relative inline-flex items-center">
      <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
      <select
        value={current}
        onChange={(e) => handlePeriodChange(e.target.value)}
        aria-label={t("periodLabel")}
        className="appearance-none rounded-lg border border-border bg-card py-2 pl-9 pr-9 text-sm font-medium text-foreground shadow-card outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {options.map((period) => (
          <option key={period} value={period}>
            {labels[period] ?? period}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" />
    </div>
  );
}
