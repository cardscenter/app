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
    <div className="space-y-10">
      {/* Success header */}
      <div className="flex flex-col items-center gap-3 rounded-[16px] bg-[var(--pastel-green)] p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--foreground)]">
          <CheckCircle2 className="h-8 w-8 text-[var(--pastel-green)]" />
        </div>
        <h2 className="cc-display text-4xl text-[var(--foreground)]">{t("successTitle")}</h2>
        <p className="cc-prose max-w-xl text-base">{t("successDesc")}</p>
        <p className="mt-2 text-xs text-[var(--foreground)]/60">
          {t("referenceLabel")}: <span className="font-mono font-semibold">{requestId}</span>
        </p>
      </div>

      {/* Full packing guide */}
      <PackingInstructions />

      {/* Footer actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/dashboard/inkoop/${requestId}`}
          className="flex flex-1 items-center justify-center gap-2 cc-pill cc-grad px-6 py-4 text-sm font-semibold leading-none text-white"
        >
          {t("viewMyRequest")} <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/verkopen"
          className="flex flex-1 items-center justify-center gap-2 cc-pill border border-[var(--border)] bg-white px-6 py-4 text-sm font-semibold leading-none text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
        >
          {t("createNew")}
        </Link>
      </div>
    </div>
  );
}
