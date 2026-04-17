"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import { CheckSquare, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { PayoutMethodSelect } from "./payout-method-select";
import { BuybackSuccess } from "./buyback-success";
import { submitBulkBuyback } from "@/actions/buyback";
import { BULK_PRICING, MINIMUM_BULK_VALUE, getStoreCreditBonus, type BulkCategoryKey } from "@/lib/buyback-pricing";
import type { PayoutMethod } from "@/types";

export function BulkCalculator() {
  const t = useTranslations("buyback");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Quantities per category
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(Object.keys(BULK_PRICING).map((k) => [k, 0]))
  );

  // Payout state
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("BANK");
  const [iban, setIban] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  // Confirmation checkboxes
  const [confirmNM, setConfirmNM] = useState(false);
  const [confirmSorted, setConfirmSorted] = useState(false);

  const [successId, setSuccessId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionState, formAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await submitBulkBuyback(formData);
      return result ?? null;
    },
    null
  );

  useEffect(() => {
    if (actionState?.success && actionState.requestId) {
      setSuccessId(actionState.requestId);
      setStep(3);
      toast.success(t("successTitle"));
    } else if (actionState?.error) {
      toast.error(actionState.error);
    }
  }, [actionState, t]);

  // Compute totals
  const categoryTotals = Object.entries(BULK_PRICING).map(([key, config]) => {
    const qty = quantities[key] || 0;
    return { key, label: t(config.labelKey), price: config.price, quantity: qty, subtotal: qty * config.price };
  });

  const total = Math.round(categoryTotals.reduce((sum, c) => sum + c.subtotal, 0) * 100) / 100;
  const totalItems = categoryTotals.reduce((sum, c) => sum + c.quantity, 0);
  const minimumMet = total >= MINIMUM_BULK_VALUE;
  const hasItems = totalItems > 0;
  const bonusAmount = getStoreCreditBonus(total);

  function handleSubmit() {
    const bulkItems = categoryTotals
      .filter((c) => c.quantity > 0)
      .map((c) => ({ category: c.key, quantity: c.quantity }));

    const formData = new FormData();
    formData.set("bulkItems", JSON.stringify(bulkItems));
    formData.set("payoutMethod", payoutMethod);
    if (payoutMethod === "BANK") {
      formData.set("iban", iban);
      formData.set("accountHolder", accountHolder);
    }
    formData.set("confirmNearMint", String(confirmNM));
    formData.set("confirmSorted", String(confirmSorted));

    startTransition(() => formAction(formData));
  }

  // Step 3: Success
  if (step === 3 && successId) {
    return <BuybackSuccess requestId={successId} />;
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Category quantities */}
      {step === 1 && (
        <>
          <div className="glass overflow-hidden rounded-xl">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">{t("bulkCategory")}</th>
                  <th className="px-4 py-3 text-right">{t("bulkPricePerUnit")}</th>
                  <th className="px-4 py-3 text-center">{t("quantity")}</th>
                  <th className="px-4 py-3 text-right">{t("bulkSubtotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {categoryTotals.map((cat) => (
                  <tr key={cat.key} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{cat.label}</td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                      €{cat.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        max={99999}
                        value={cat.quantity || ""}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [cat.key]: Math.max(0, parseInt(e.target.value) || 0),
                          }))
                        }
                        className="mx-auto block w-24 rounded-lg border border-input bg-background px-3 py-1.5 text-center text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      {cat.subtotal > 0 ? `€${cat.subtotal.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total bar */}
          <div className="glass flex items-center justify-between rounded-xl p-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("totalItems")}: {totalItems}
              </p>
              {!minimumMet && hasItems && (
                <p className="text-xs text-red-500">{t("minimumNotMetBulk")}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{t("estimatedPayout")}</p>
              <p className="text-xl font-bold text-emerald-600">€{total.toFixed(2)}</p>
            </div>
          </div>

          {hasItems && minimumMet && (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              {t("nextStep")} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </>
      )}

      {/* Step 2: Confirmation */}
      {step === 2 && (
        <div className="mx-auto max-w-2xl space-y-6">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {t("previousStep")}
          </button>

          <h2 className="text-xl font-bold">{t("confirmation")}</h2>

          {/* Summary table */}
          <div className="glass overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/30">
                {categoryTotals
                  .filter((c) => c.quantity > 0)
                  .map((cat) => (
                    <tr key={cat.key}>
                      <td className="px-4 py-2 font-medium">{cat.label}</td>
                      <td className="px-4 py-2 text-center text-muted-foreground">
                        {cat.quantity}x €{cat.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        €{cat.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                <tr className="font-bold">
                  <td className="px-4 py-3">{t("total")}</td>
                  <td className="px-4 py-3 text-center">{totalItems} items</td>
                  <td className="px-4 py-3 text-right text-emerald-600">€{total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payout method */}
          <PayoutMethodSelect
            value={payoutMethod}
            onChange={setPayoutMethod}
            iban={iban}
            onIbanChange={setIban}
            accountHolder={accountHolder}
            onAccountHolderChange={setAccountHolder}
            estimatedPayout={total}
            bonusAmount={bonusAmount}
          />

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmNM}
                onChange={(e) => setConfirmNM(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>{t("confirmNearMint")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmSorted}
                onChange={(e) => setConfirmSorted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>{t("confirmSorted")}</span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isPending ||
              !confirmNM ||
              !confirmSorted ||
              !minimumMet ||
              (payoutMethod === "BANK" && (!iban || !accountHolder))
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare className="h-4 w-4" />
            {isPending ? t("submitting") : t("submitRequest")}
          </button>

          {actionState?.error && (
            <p className="text-center text-sm text-red-500">{actionState.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
