"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { X, ShoppingBasket, ShieldCheck } from "lucide-react";
import {
  createPartialSaleProposal,
  getListingItemsForPartialSale,
} from "@/actions/proposal";

interface ListingItem {
  id: string;
  cardName: string;
  condition: string | null;
  quantity: number;
  cardSetId: string | null;
}

interface Props {
  conversationId: string;
  listingId: string;
  listingTitle: string;
  onClose: () => void;
}

export function PartialSaleForm({ conversationId, listingId, listingTitle, onClose }: Props) {
  const t = useTranslations("partialSaleForm");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [items, setItems] = useState<ListingItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [requestInsured, setRequestInsured] = useState(false);
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await getListingItemsForPartialSale(listingId);
      if (result.success) {
        setItems(result.items as never);
      } else {
        setError(result.error ?? "Geen items beschikbaar");
      }
      setLoadingItems(false);
    })();
  }, [listingId]);

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    if (selectedIds.size === 0) {
      setError(t("errors.noItems"));
      return;
    }
    const amount = parseFloat(totalAmount);
    if (!amount || amount <= 0) {
      setError(t("errors.invalidAmount"));
      return;
    }

    startTransition(async () => {
      const result = await createPartialSaleProposal({
        conversationId,
        listingId,
        itemIds: Array.from(selectedIds),
        totalAmount: amount,
        requestInsuredShipping: requestInsured,
      });
      if (result.error) setError(result.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="glass max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBasket className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-5 truncate text-sm text-muted-foreground">
          {t("subtitle", { title: listingTitle })}
        </p>

        {/* Items selector */}
        <div className="mb-5">
          <h3 className="mb-2 text-sm font-medium text-foreground">
            {t("selectItems")} ({selectedIds.size}/{items.length})
          </h3>
          {loadingItems ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noItems")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {items.map((it) => {
                const checked = selectedIds.has(it.id);
                return (
                  <button
                    type="button"
                    key={it.id}
                    onClick={() => toggleItem(it.id)}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <input type="checkbox" checked={checked} readOnly className="h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {it.quantity > 1 ? `${it.quantity}× ` : ""}{it.cardName}
                      </p>
                      {it.condition && (
                        <p className="text-xs text-muted-foreground">{it.condition}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Insured-toggle */}
        <div className="mb-5">
          <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={requestInsured}
              onChange={(e) => setRequestInsured(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                {t("requestInsured.label")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("requestInsured.hint")}</p>
            </div>
          </label>
        </div>

        {/* Total amount */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-foreground">{t("totalAmount")}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("amountHint")}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || selectedIds.size === 0}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? "..." : t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
