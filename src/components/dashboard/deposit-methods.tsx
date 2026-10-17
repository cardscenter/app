"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PLATFORM, PLATFORM_IBAN_DISPLAY } from "@/lib/platform-config";

interface DepositMethodsProps {
  bankTransferReference: string | null;
}

export function DepositMethods({ bankTransferReference }: DepositMethodsProps) {
  const t = useTranslations("wallet");
  const [activeTab, setActiveTab] = useState<"bank" | "ideal">("bank");
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">
        {t("depositTitle")}
      </h2>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
        <button
          onClick={() => setActiveTab("bank")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "bank"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("bankTransfer")}
        </button>
        <button
          onClick={() => setActiveTab("ideal")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "ideal"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          iDEAL
        </button>
      </div>

      {/* Bank transfer tab */}
      {activeTab === "bank" && (
        <div className="mt-4 dash-card p-5">
          <p className="text-sm text-muted-foreground">
            {t("bankTransferInstructions")}
          </p>

          <div className="mt-4 space-y-3">
            {/* IBAN */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">IBAN</p>
                <p className="font-mono text-sm font-medium text-foreground">
                  {PLATFORM_IBAN_DISPLAY}
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(PLATFORM.bank.iban, "iban")}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                {copied === "iban" ? t("copied") : t("copy")}
              </button>
            </div>

            {/* BIC — handig voor stortingen vanuit BE/DE */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">{t("bic")}</p>
                <p className="font-mono text-sm font-medium text-foreground">
                  {PLATFORM.bank.bic}
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(PLATFORM.bank.bic, "bic")}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                {copied === "bic" ? t("copied") : t("copy")}
              </button>
            </div>

            {/* Account name */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">{t("accountName")}</p>
                <p className="text-sm font-medium text-foreground">
                  {PLATFORM.bank.accountHolder}
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(PLATFORM.bank.accountHolder, "name")}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                {copied === "name" ? t("copied") : t("copy")}
              </button>
            </div>

            {/* Reference code */}
            {bankTransferReference && (
              <div className="flex items-center justify-between rounded-md bg-blue-50 px-4 py-3">
                <div>
                  <p className="text-xs text-blue-600">{t("referenceCode")}</p>
                  <p className="font-mono text-sm font-bold text-blue-700">
                    {bankTransferReference}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(bankTransferReference, "ref")}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
                >
                  {copied === "ref" ? t("copied") : t("copy")}
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-md bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-700">
              ⚠ {t("referenceWarning")}
            </p>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {t("minimumDeposit")}
          </p>
        </div>
      )}

      {/* iDEAL tab */}
      {activeTab === "ideal" && (
        <div className="mt-4 dash-card p-5">
          <div className="flex flex-col items-center py-8 text-center">
            <div className="rounded-full bg-muted p-4">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">
              {t("idealComingSoon")}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {t("idealComingSoonDescription")}
            </p>
            <button
              disabled
              className="mt-6 cursor-not-allowed rounded-md bg-muted px-6 py-2 text-sm font-medium text-muted-foreground"
            >
              {t("idealButton")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
