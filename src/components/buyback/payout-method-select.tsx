"use client";

import { useTranslations } from "next-intl";
import { Banknote, Wallet } from "lucide-react";
import type { PayoutMethod } from "@/types";

interface PayoutMethodSelectProps {
  value: PayoutMethod;
  onChange: (method: PayoutMethod) => void;
  iban: string;
  onIbanChange: (v: string) => void;
  accountHolder: string;
  onAccountHolderChange: (v: string) => void;
  estimatedPayout: number;
  bonusAmount: number;
}

export function PayoutMethodSelect({
  value,
  onChange,
  iban,
  onIbanChange,
  accountHolder,
  onAccountHolderChange,
  estimatedPayout,
  bonusAmount,
}: PayoutMethodSelectProps) {
  const t = useTranslations("buyback");

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t("payoutMethod")}</h3>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Bank transfer */}
        <button
          type="button"
          onClick={() => onChange("BANK")}
          className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
            value === "BANK"
              ? "border-primary bg-primary/5"
              : "border-transparent bg-white/50 hover:border-muted dark:bg-white/5"
          }`}
        >
          <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">{t("payoutBank")}</p>
            <p className="text-sm text-muted-foreground">
              €{estimatedPayout.toFixed(2)}
            </p>
          </div>
        </button>

        {/* Store credit */}
        <button
          type="button"
          onClick={() => onChange("STORE_CREDIT")}
          className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
            value === "STORE_CREDIT"
              ? "border-emerald-500 bg-emerald-500/5"
              : "border-transparent bg-white/50 hover:border-muted dark:bg-white/5"
          }`}
        >
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <p className="flex items-center gap-2 font-medium">
              {t("payoutStoreCredit")}
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600">
                {t("storeCreditBonus")}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {t("storeCreditBonusDesc")}
            </p>
            {bonusAmount > 0 && (
              <div className="mt-1 text-sm">
                <span className="text-muted-foreground">{t("bonusAmount")}: </span>
                <span className="font-medium text-emerald-600">+€{bonusAmount.toFixed(2)}</span>
                <span className="ml-2 text-muted-foreground">{t("totalWithBonus")}: </span>
                <span className="font-bold text-emerald-600">
                  €{(estimatedPayout + bonusAmount).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* IBAN fields (only for bank) */}
      {value === "BANK" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("ibanLabel")}</label>
            <input
              type="text"
              value={iban}
              onChange={(e) => onIbanChange(e.target.value.toUpperCase())}
              placeholder={t("ibanPlaceholder")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
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
      )}
    </div>
  );
}
