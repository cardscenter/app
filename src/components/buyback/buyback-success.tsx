"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { PackingInstructions } from "./packing-instructions";

interface BuybackSuccessProps {
  requestId: string;
}

export function BuybackSuccess({ requestId }: BuybackSuccessProps) {
  const t = useTranslations("buyback");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Success header */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center dark:border-emerald-800/50 dark:bg-emerald-950/20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{t("successTitle")}</h2>
        <p className="max-w-xl text-sm text-emerald-900/80 dark:text-emerald-100/80">{t("successDesc")}</p>
        <p className="mt-2 text-xs text-emerald-800/70 dark:text-emerald-200/70">
          {t("referenceLabel")}: <span className="font-mono font-semibold">{requestId}</span>
        </p>
      </div>

      {/* Full packing guide */}
      <PackingInstructions />

      {/* Footer actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/inkoop/${requestId}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          {t("viewMyRequest")} <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/verkoop-calculator"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-input px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          {t("createNew")}
        </Link>
      </div>
    </div>
  );
}
