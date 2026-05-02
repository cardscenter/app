"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { X, ShoppingBasket, ShieldCheck, Minus, Plus } from "lucide-react";
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
  tcgdexId: string | null;
}

// Groep van identieke items zodat de UI één rij per kaart toont met een
// stepper, ipv N losse checkboxes voor bv. "5x Pikachu". Backend krijgt
// alsnog losse item-ids — we picken er N uit de groep bij submit.
interface ItemGroup {
  key: string;
  cardName: string;
  condition: string | null;
  cardSetId: string | null;
  tcgdexId: string | null;
  itemIds: string[]; // alle AVAILABLE items in deze groep
}

function groupKey(it: ListingItem) {
  return `${it.cardName}|${it.condition ?? ""}|${it.tcgdexId ?? ""}|${it.cardSetId ?? ""}`;
}

function groupItems(items: ListingItem[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const it of items) {
    const key = groupKey(it);
    const existing = map.get(key);
    if (existing) {
      existing.itemIds.push(it.id);
    } else {
      map.set(key, {
        key,
        cardName: it.cardName,
        condition: it.condition,
        cardSetId: it.cardSetId,
        tcgdexId: it.tcgdexId,
        itemIds: [it.id],
      });
    }
  }
  return Array.from(map.values());
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
  // selectedCounts: hoeveel exemplaren van elke groep de buyer wil
  const [selectedCounts, setSelectedCounts] = useState<Map<string, number>>(new Map());
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

  const groups = useMemo(() => groupItems(items), [items]);
  const totalSelected = useMemo(
    () => Array.from(selectedCounts.values()).reduce((sum, n) => sum + n, 0),
    [selectedCounts]
  );

  function setCountFor(key: string, n: number, max: number) {
    const clamped = Math.max(0, Math.min(n, max));
    setSelectedCounts((prev) => {
      const next = new Map(prev);
      if (clamped === 0) next.delete(key);
      else next.set(key, clamped);
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    if (totalSelected === 0) {
      setError(t("errors.noItems"));
      return;
    }
    const amount = parseFloat(totalAmount);
    if (!amount || amount <= 0) {
      setError(t("errors.invalidAmount"));
      return;
    }

    // Resolveer selectedCounts naar concrete itemIds — pak de eerste N uit
    // elke groep (volgorde maakt niet uit; alle items in de groep zijn
    // identiek qua naam/conditie).
    const itemIds: string[] = [];
    for (const group of groups) {
      const n = selectedCounts.get(group.key) ?? 0;
      itemIds.push(...group.itemIds.slice(0, n));
    }

    startTransition(async () => {
      const result = await createPartialSaleProposal({
        conversationId,
        listingId,
        itemIds,
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

        {/* Items selector — grouped by (name, condition, tcgdex) met stepper */}
        <div className="mb-5">
          <h3 className="mb-2 text-sm font-medium text-foreground">
            {t("selectItems")} ({totalSelected}/{items.length})
          </h3>
          {loadingItems ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noItems")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {groups.map((g) => {
                const max = g.itemIds.length;
                const count = selectedCounts.get(g.key) ?? 0;
                const isSelected = count > 0;
                return (
                  <div
                    key={g.key}
                    className={`flex items-center gap-3 rounded-lg border p-2 transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {g.cardName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {g.condition && <>{g.condition} · </>}
                        {max > 1 ? t("availableMulti", { count: max }) : t("availableSingle")}
                      </p>
                    </div>
                    {max === 1 ? (
                      <button
                        type="button"
                        onClick={() => setCountFor(g.key, isSelected ? 0 : 1, 1)}
                        className="h-8 w-8 rounded-md border border-border text-sm font-medium hover:bg-muted"
                      >
                        {isSelected ? "✓" : "+"}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCountFor(g.key, count - 1, max)}
                          disabled={count === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium tabular-nums">
                          {count} <span className="text-muted-foreground">/ {max}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setCountFor(g.key, count + 1, max)}
                          disabled={count >= max}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
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
            disabled={pending || totalSelected === 0}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? "..." : t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
