"use client";

import { useTranslations } from "next-intl";
import { Wallet, CreditCard, X, ArrowUpCircle, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

interface PaymentMethodModalProps {
  totalCost: number;
  /** Echte beschikbare saldo (= balance - reservedBalance). Dit is wat overal
   *  als "Beschikbaar" getoond wordt. */
  availableBalance: number;
  /** Extra krediet specifiek voor DEZE betaling — bv. de 15%-reservering die
   *  al voor deze auction is vastgehouden en bij payment automatisch wordt
   *  vrijgegeven (Fase 29 — was 40%). Telt mee voor de canPay-check, maar
   *  verschijnt apart in de UI zodat de koper begrijpt waar het vandaan komt.
   *  Default 0. */
  extraCredit?: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  // Optionele samenvatting van wat de koper afrekent — bv. voor de
  // direct-buy-flow waarbij geen winkelwagen-pagina ervoor zit.
  // Wordt gerenderd boven de totaal-regel, onder de payment-keuzes.
  summary?: ReactNode;
  /** Als gezet: groene info-balk met "Je items zijn N minuten vastgezet zodat
   *  je rustig kan afrekenen". Alleen relevant voor claimsale-checkout — bij
   *  direct-buy is er geen claim-timer dus geen notice nodig. */
  checkoutLockMinutes?: number;
}

export function PaymentMethodModal({
  totalCost,
  availableBalance,
  extraCredit = 0,
  onConfirm,
  onCancel,
  loading,
  summary,
  checkoutLockMinutes,
}: PaymentMethodModalProps) {
  const t = useTranslations("cart");

  // Effectief beschikbaar = saldo + extraCredit (bv. eigen-reserve op deze auction)
  const effectivelyAvailable = availableBalance + extraCredit;
  const hasEnoughBalance = effectivelyAvailable >= totalCost;

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

        {/* Checkout-lock notice — alleen voor claimsale-flow, voorkomt dat
            de buyer in paniek raakt door de timer in de achtergrond. */}
        {checkoutLockMinutes && checkoutLockMinutes > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Je items zijn{" "}
              <span className="font-semibold">{checkoutLockMinutes} minuten</span>{" "}
              vastgezet zodat je rustig kan afrekenen — ook als de claim-timer
              in je winkelwagen verloopt.
            </p>
          </div>
        )}

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
              {extraCredit > 0 && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  + €{extraCredit.toFixed(2)} reeds gereserveerd voor deze betaling
                </p>
              )}
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

        {/* Optionele samenvatting (bv. items voor direct-buy) */}
        {summary && (
          <div className="mt-4 border-t border-border pt-4">
            {summary}
          </div>
        )}

        {/* Total */}
        <div className={`${summary ? "mt-3" : "mt-4 border-t border-border pt-4"} flex items-center justify-between`}>
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