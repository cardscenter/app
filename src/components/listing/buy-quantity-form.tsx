"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, AlertTriangle } from "lucide-react";
import { buyListing } from "@/actions/listing";

interface ShippingMethodOption {
  id: string;
  carrier: string;
  serviceName: string;
  price: number;
  isSigned: boolean;
}

interface Props {
  listingId: string;
  unitPrice: number;
  shippingCost: number;
  freeShipping: boolean;
  available: number;
  shippingMethods: ShippingMethodOption[];
}

// Direct-buy-flow voor SEALED_PRODUCT en OTHER met stockQuantity. Toont een
// stepper voor "hoeveel?" + het rolling totaal en triggert buyListing met
// quantity. Verzending = één keer (niet × N) want de hele bestelling gaat
// als één pakket.
export function BuyQuantityForm({
  listingId,
  unitPrice,
  shippingCost: defaultShippingCost,
  freeShipping,
  available,
  shippingMethods,
}: Props) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(1);
  const [selectedShippingId, setSelectedShippingId] = useState<string>(
    shippingMethods[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);

  const selectedMethod = shippingMethods.find((m) => m.id === selectedShippingId) ?? null;
  const shippingCost = freeShipping ? 0 : selectedMethod?.price ?? defaultShippingCost;
  const itemSubtotal = unitPrice * quantity;
  const total = itemSubtotal + shippingCost;

  const setQty = (n: number) => setQuantity(Math.max(1, Math.min(n, available)));

  function handleBuy() {
    setError(null);
    startTransition(async () => {
      const result = await buyListing(listingId, selectedShippingId || undefined, quantity);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Quantity stepper */}
      {available > 1 ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("buyQuantity.label")}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQty(quantity - 1)}
              disabled={pending || quantity <= 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              min={1}
              max={available}
              value={quantity}
              onChange={(e) => setQty(parseInt(e.target.value) || 1)}
              className="h-9 w-16 rounded-lg border border-border bg-background text-center text-sm font-medium text-foreground tabular-nums"
            />
            <button
              type="button"
              onClick={() => setQty(quantity + 1)}
              disabled={pending || quantity >= available}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              {t("stockQuantity.available", { count: available })}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("stockQuantity.available", { count: available })}</p>
      )}

      {/* Shipping picker — only when seller offers methods */}
      {shippingMethods.length > 0 && !freeShipping && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("buyQuantity.shippingLabel")}
          </label>
          <select
            value={selectedShippingId}
            onChange={(e) => setSelectedShippingId(e.target.value)}
            disabled={pending}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {shippingMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.carrier} {m.serviceName} — €{m.price.toFixed(2)}
                {m.isSigned ? " (aangetekend)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Total breakdown */}
      <div className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>{quantity}× €{unitPrice.toFixed(2)}</span>
          <span>€{itemSubtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t("shippingCost")}</span>
          <span>{freeShipping ? t("freeShipping") : `€${shippingCost.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground">
          <span>{t("buyQuantity.total")}</span>
          <span>€{total.toFixed(2)}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleBuy}
        disabled={pending || quantity < 1}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        <ShoppingCart className="h-4 w-4" />
        {pending ? "..." : t("buyQuantity.buyNow")}
      </button>
    </div>
  );
}
