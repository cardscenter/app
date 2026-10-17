"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <div className="dash-card p-6 max-w-md w-full text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--pastel-pink)]">
          <AlertTriangle className="size-7 text-[var(--pastel-pink-ink)]" />
        </div>
        <h2 className="mt-4 cc-display text-[28px] text-foreground">{t("title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 cc-pill cc-grad px-5 py-2.5 text-sm font-semibold text-white"
          >
            <RefreshCw className="size-4" />
            {t("tryAgain")}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 cc-pill border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-background"
          >
            <LayoutDashboard className="size-4" />
            {t("goToDashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
