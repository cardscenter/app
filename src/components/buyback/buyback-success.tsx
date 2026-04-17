"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, Package, ArrowRight } from "lucide-react";

interface BuybackSuccessProps {
  requestId: string;
}

export function BuybackSuccess({ requestId }: BuybackSuccessProps) {
  const t = useTranslations("buyback");

  const packingSteps = [
    t("packingStep1"),
    t("packingStep2"),
    t("packingStep3"),
    t("packingStep4"),
    t("packingStep5"),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Success header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold">{t("successTitle")}</h2>
        <p className="text-muted-foreground">{t("successDesc")}</p>
      </div>

      {/* Reference */}
      <div className="glass rounded-xl p-4 text-center">
        <p className="text-sm text-muted-foreground">{t("referenceLabel")}</p>
        <p className="mt-1 font-mono text-lg font-bold">{requestId}</p>
      </div>

      {/* Shipping address */}
      <div className="glass rounded-xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{t("shippingTitle")}</h3>
        </div>
        <pre className="whitespace-pre-line rounded-lg bg-muted/50 p-4 text-sm">
          {t("shippingAddress")}
        </pre>
      </div>

      {/* Packing instructions */}
      <div className="glass rounded-xl p-5">
        <h3 className="mb-3 font-semibold">{t("packingInstructions")}</h3>
        <ol className="space-y-2">
          {packingSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard/inkoop"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          {t("goToDashboard")} <ArrowRight className="h-4 w-4" />
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
