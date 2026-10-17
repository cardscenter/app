"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="cc-punch relative rounded-[20px] bg-white p-8 max-w-md w-full text-center">
        <span className="cc-punch-dots" aria-hidden />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--pastel-pink)]">
          <AlertTriangle className="size-7 text-[var(--pastel-pink-ink)]" />
        </div>
        <h2 className="mt-4 cc-display text-[32px] text-foreground">{t("title")}</h2>
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
            href="/"
            className="inline-flex items-center justify-center gap-2 cc-pill border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-background"
          >
            <Home className="size-4" />
            {t("goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
