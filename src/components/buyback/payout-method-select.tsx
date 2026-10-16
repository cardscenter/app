"use client";

import { useTranslations } from "next-intl";
import { Banknote, Lock } from "lucide-react";
import { formatIbanForDisplay } from "@/lib/validations/iban";

interface PayoutMethodSelectProps {
  iban: string;
  onIbanChange: (v: string) => void;
  accountHolder: string;
  onAccountHolderChange: (v: string) => void;
  estimatedPayout: number;
}

/**
 * Uitbetaling (Community Hub, Fase 6): alleen nog naar een bankrekening. Het
 * IBAN wordt versleuteld opgeslagen en alleen gemaskeerd getoond; vooraf
 * ingevuld uit het profiel als dat er is.
 */
export function PayoutMethodSelect({ iban, onIbanChange, accountHolder, onAccountHolderChange, estimatedPayout }: PayoutMethodSelectProps) {
  const t = useTranslations("buyback");

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t("payoutMethod")}</h3>
      <div className="flex items-start gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4">
        <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">{t("payoutBank")}</p>
          <p className="text-sm text-muted-foreground">€{estimatedPayout.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("payoutBankNote")}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("ibanLabel")}</label>
          <input
            type="text"
            value={iban}
            onChange={(e) => onIbanChange(e.target.value.toUpperCase())}
            onBlur={() => iban && onIbanChange(formatIbanForDisplay(iban.replace(/\s+/g, "")))}
            placeholder={t("ibanPlaceholder")}
            autoComplete="off"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("accountHolderLabel")}</label>
          <input
            type="text"
            value={accountHolder}
            onChange={(e) => onAccountHolderChange(e.target.value)}
            placeholder={t("accountHolderPlaceholder")}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" /> {t("ibanEncryptedNote")}
      </p>
    </div>
  );
}
