"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { issueSellerRefund } from "@/actions/purchase";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

export function SellerRefundForm({
  bundleId,
  buyerName,
  totalCost,
  refundedAmount,
}: {
  bundleId: string;
  buyerName: string;
  totalCost: number;
  refundedAmount: number;
}) {
  const t = useTranslations("sales");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const maxRefundable = Math.round((totalCost - (refundedAmount ?? 0)) * 100) / 100;
  const isFullyRefunded = maxRefundable <= 0;

  const refundAmount = Math.min(parseFloat(amount) || 0, maxRefundable);
  const isValid = refundAmount > 0 && refundAmount <= maxRefundable;

  async function handleRefund() {
    setSubmitting(true);
    const result = await issueSellerRefund(bundleId, refundAmount, reason.trim() || undefined);
    if (result?.error) {
      toast.error(result.error);
      setSubmitting(false);
      setShowConfirm(false);
    } else {
      toast.success(t("refundSuccess", { amount: refundAmount.toFixed(2) }));
      setSubmitting(false);
      setShowConfirm(false);
      setOpen(false);
      setAmount("");
      setReason("");
      router.refresh();
    }
  }

  if (isFullyRefunded) {
    return (
      <p className="text-xs text-muted-foreground italic">{t("refundFullyRefunded")}</p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-400 dark:hover:bg-orange-950"
      >
        <RotateCcw className="h-4 w-4" />
        {t("refundButton")}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900 dark:bg-orange-950/20">
      <h4 className="text-sm font-semibold text-foreground">{t("refundTitle")}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{t("refundDescription")}</p>

      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{t("refundMaxAmount", { amount: maxRefundable.toFixed(2) })}</span>
        {refundedAmount > 0 && (
          <span className="text-orange-600 dark:text-orange-400">
            {t("refundAlreadyRefunded", { amount: refundedAmount.toFixed(2) })}
          </span>
        )}
      </div>

      {/* Amount input */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {t("refundAmountLabel")}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">&euro;</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={maxRefundable}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("refundAmountPlaceholder")}
            className="w-full rounded-lg glass-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* Reason input (optioneel) */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {t("refundReasonLabel")}
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("refundReasonPlaceholder")}
          maxLength={120}
          className="w-full rounded-lg glass-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      </div>

      {/* Confirm/cancel */}
      {!showConfirm ? (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!isValid}
            className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("refundButton")} &euro;{refundAmount.toFixed(2)}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setAmount("");
              setReason("");
              setShowConfirm(false);
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            {t("refundCancelButton")}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-orange-300 bg-orange-100 p-3 dark:border-orange-800 dark:bg-orange-950/40">
          <p className="text-sm text-orange-800 dark:text-orange-300">
            {t("refundConfirm", { amount: refundAmount.toFixed(2), buyer: buyerName })}
          </p>
          {reason.trim() && (
            <p className="mt-1.5 text-xs text-orange-700/80 dark:text-orange-400/80 italic">
              &ldquo;{reason.trim()}&rdquo;
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleRefund}
              disabled={submitting}
              className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? "..." : t("refundConfirmButton")}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={submitting}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              {t("refundCancelButton")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
