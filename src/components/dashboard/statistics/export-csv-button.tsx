"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";

type Props = {
  section: "sales" | "buyer" | "performance" | "commission" | "xp";
  period: string;
};

export function ExportCsvButton({ section, period }: Props) {
  const t = useTranslations("dashboard.statistics.export");

  return (
    <a
      href={`/api/statistics/export/${section}?period=${encodeURIComponent(period)}`}
      download
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/30 hover:text-foreground"
    >
      <Download className="h-3.5 w-3.5" />
      {t("csv")}
    </a>
  );
}
