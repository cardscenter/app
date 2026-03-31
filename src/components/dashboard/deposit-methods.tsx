"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface DepositMethodsProps {
  bankTransferReference: string | null;
}

const PLACEHOLDER_IBAN = "NL00 ABNA 0000 0000 00";
const PLACEHOLDER_NAME = "TCG Marketplace B.V.";

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
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {t("depositTitle")}
      </h2>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={() => setActiveTab("bank")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "bank"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {t("bankTransfer")}
        </button>
        <button
          onClick={() => setActiveTab("ideal")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "ideal"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          iDEAL
        </button>
      </div>

      {/* Bank transfer tab */}
      {activeTab === "bank" && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("bankTransferInstructions")}
          </p>

          <div className="mt-4 space-y-3">
            {/* IBAN */}
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">IBAN</p>
                <p className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {PLACEHOLDER_IBAN}
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(PLACEHOLDER_IBAN.replace(/\s/g, ""), "iban")}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                {copied === "iban" ? t("copied") : t("copy")}
              </button>
            </div>

            {/* Account name */}
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("accountName")}</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {PLACEHOLDER_NAME}
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(PLACEHOLDER_NAME, "name")}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                {copied === "name" ? t("copied") : t("copy")}
              </button>
            </div>

            {/* Reference code */}
            {bankTransferReference && (
              <div className="flex items-center justify-between rounded-md bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400">{t("referenceCode")}</p>
                  <p className="font-mono text-sm font-bold text-blue-700 dark:text-blue-300">
                    {bankTransferReference}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(bankTransferReference, "ref")}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30"
                >
                  {copied === "ref" ? t("copied") : t("copy")}
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-md bg-amber-50 px-4 py-3 dark:bg-amber-900/10">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠ {t("referenceWarning")}
            </p>
          </div>

          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {t("minimumDeposit")}
          </p>
        </div>
      )}

      {/* iDEAL tab */}
      {activeTab === "ideal" && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <div className="flex flex-col items-center py-8 text-center">
            <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
              <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              {t("idealComingSoon")}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              {t("idealComingSoonDescription")}
            </p>
            <button
              disabled
              className="mt-6 cursor-not-allowed rounded-md bg-zinc-200 px-6 py-2 text-sm font-medium text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
            >
              {t("idealButton")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
