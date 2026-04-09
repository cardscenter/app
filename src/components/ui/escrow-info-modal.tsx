"use client";

import { useTranslations } from "next-intl";
import { X, ShieldCheck, ArrowDown, User, Landmark, Store, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

interface EscrowInfoModalProps {
  onClose: () => void;
}

export function EscrowInfoModal({ onClose }: EscrowInfoModalProps) {
  const t = useTranslations("wallet");

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-background border border-border p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
              <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground">{t("escrow.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {t("escrow.description")}
        </p>

        {/* Visual flow */}
        <div className="rounded-xl border border-border bg-muted/30 p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t("escrow.howItWorks")}</h3>

          <div className="flex gap-3">
            {/* Left: icons + arrows column */}
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <ArrowDown className="my-1.5 h-4 w-4 text-muted-foreground/40" />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <Landmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <ArrowDown className="my-1.5 h-4 w-4 text-muted-foreground/40" />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                <Store className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <ArrowDown className="my-1.5 h-4 w-4 text-muted-foreground/40" />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>

            {/* Right: step descriptions */}
            <div className="flex flex-col justify-between flex-1 min-w-0 py-1">
              <div>
                <p className="text-sm font-medium text-foreground">{t("escrow.step1Title")}</p>
                <p className="text-xs text-muted-foreground">{t("escrow.step1Desc")}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("escrow.step2Title")}</p>
                <p className="text-xs text-muted-foreground">{t("escrow.step2Desc")}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("escrow.step3Title")}</p>
                <p className="text-xs text-muted-foreground">{t("escrow.step3Desc")}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("escrow.step4Title")}</p>
                <p className="text-xs text-muted-foreground">{t("escrow.step4Desc")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dispute note */}
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{t("escrow.disputeTitle")}</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">{t("escrow.disputeDesc")}</p>
          </div>
        </div>

        {/* Auto-release note */}
        <p className="mt-4 text-xs text-muted-foreground/70 text-center">
          {t("escrow.autoRelease")}
        </p>
      </div>
    </div>
  );
}
