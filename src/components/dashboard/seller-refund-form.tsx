"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { issueSellerRefund } from "@/actions/purchase";
import { toast } from "sonner";
import { RotateCcw, Check } from "lucide-react";
import Image from "next/image";

type BundleItem = {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  imageUrl: string | null;
  refundedAt: string | null;
};

export function SellerRefundForm({
  bundleId,
  buyerName,
  totalCost,
  refundedAmount,
  items,
}: {
  bundleId: string;
  buyerName: string;
  totalCost: number;
  refundedAmount: number;
  items: BundleItem[];
}) {
  const t = useTranslations("sales");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(items.length === 0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const maxRefundable = Math.round((totalCost - (refundedAmount ?? 0)) * 100) / 100;
  const isFullyRefunded = maxRefundable <= 0;

  const refundableItems = items.filter((item) => !item.refundedAt);

  const selectedItemTotal = items
    .filter((item) => selectedItemIds.has(item.id))
    .reduce((sum, item) => sum + item.price, 0);

  const refundAmount = useCustom
    ? Math.min(parseFloat(customAmount) || 0, maxRefundable)
    : Math.min(selectedItemTotal, maxRefundable);

  const isValid = refundAmount > 0 && refundAmount <= maxRefundable;

  function toggleItem(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setUseCustom(false);
  }

  function switchToCustom() {
    setUseCustom(true);
    setSelectedItemIds(new Set());
  }

  async function handleRefund() {
    setSubmitting(true);
    const selectedIds = useCustom ? undefined : Array.from(selectedItemIds);
    const result = await issueSellerRefund(bundleId, refundAmount, selectedIds);
    if (result?.error) {
      toast.error(result.error);
      setSubmitting(false);
      setShowConfirm(false);
    } else {
      toast.success(t("refundSuccess", { amount: refundAmount.toFixed(2) }));
      setSubmitting(false);
      setShowConfirm(false);
      setOpen(false);
      setCustomAmount("");
      setSelectedItemIds(new Set());
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

      {/* Item selection (only for claimsale bundles with items) */}
      {items.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t("refundSelectItems")}</p>
          <div className="space-y-1.5">
            {items.map((item) => {
              const isRefunded = !!item.refundedAt;
              return (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 rounded-lg border p-2 transition-colors ${
                    isRefunded
                      ? "border-border/30 bg-muted/20 cursor-not-allowed opacity-60"
                      : selectedItemIds.has(item.id) && !useCustom
                        ? "border-orange-300 bg-orange-100/50 dark:border-orange-800 dark:bg-orange-950/40 cursor-pointer"
                        : "border-border/50 hover:bg-muted/30 cursor-pointer"
                  }`}
                >
                  {isRefunded ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  ) : (
                    <input
                      type="checkbox"
                      checked={selectedItemIds.has(item.id) && !useCustom}
                      onChange={() => toggleItem(item.id)}
                      className="h-4 w-4 rounded border-border text-orange-600 focus:ring-orange-500"
                    />
                  )}
                  {item.imageUrl && (
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                      <Image src={item.imageUrl} alt={item.cardName} fill className="object-cover" sizes="32px" />
                    </div>
                  )}
                  <span className={`flex-1 text-sm truncate ${isRefunded ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.cardName}
                  </span>
                  <span className={`text-sm font-medium shrink-0 ${isRefunded ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    &euro;{item.price.toFixed(2)}
                  </span>
                  {isRefunded && (
                    <span className="text-xs text-green-600 dark:text-green-400 shrink-0">{t("refundedLabel")}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom amount */}
      <div className="mt-3">
        {items.length > 0 && (
          <button
            onClick={switchToCustom}
            className={`mb-2 text-xs font-medium transition-colors ${
              useCustom ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("refundCustomAmount")}
          </button>
        )}
        {(useCustom || items.length === 0) && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">&euro;</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={maxRefundable}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={t("refundAmountPlaceholder")}
              className="w-full rounded-lg glass-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
        )}
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
              setCustomAmount("");
              setSelectedItemIds(new Set());
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
