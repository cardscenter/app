"use client";

import { useTranslations } from "next-intl";
import { Wallet, CreditCard, X, ArrowUpCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface PaymentMethodModalProps {
  totalCost: number;
  availableBalance: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export function PaymentMethodModal({
  totalCost,
  availableBalance,
  onConfirm,
  onCancel,
  loading,
}: PaymentMethodModalProps) {
  const t = useTranslations("cart");

  const hasEnoughBalance = availableBalance >= totalCost;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl bg-background p-6 shadow-xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {t("choosePaymentMethod")}
          </h3>
          <button
            onClick={onCancel}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Wallet option */}
        <button
          onClick={onConfirm}
          disabled={!hasEnoughBalance || loading}
          className="w-full rounded-xl border-2 border-primary bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">{t("payWithWallet")}</p>
              <p className="text-sm text-muted-foreground">
                {t("availableBalance", { amount: availableBalance.toFixed(2) })}
              </p>
              {!hasEnoughBalance && (
                <p className="text-xs text-red-500 mt-0.5">
                  {t("insufficientBalance")}
                </p>
              )}
            </div>
          </div>
        </button>

        {/* Top up balance link */}
        {!hasEnoughBalance && (
          <Link
            href="/dashboard/saldo"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <ArrowUpCircle className="h-4 w-4" />
            {t("topUpBalance")}
          </Link>
        )}

        {/* iDEAL option (placeholder) */}
        <div className="mt-3 w-full rounded-xl border border-border bg-muted/30 p-4 opacity-60 cursor-not-allowed">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">{t("payWithIdeal")}</p>
              <p className="text-xs text-muted-foreground">{t("comingSoon")}</p>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="font-medium text-muted-foreground">{t("total")}</span>
          <span className="text-lg font-bold text-foreground">&euro;{totalCost.toFixed(2)}</span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={!hasEnoughBalance || loading}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {loading ? "..." : t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}