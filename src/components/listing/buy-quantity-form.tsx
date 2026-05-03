"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Minus, Plus, ShoppingCart, AlertTriangle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { buyListing } from "@/actions/listing";
import type { DeliveryChoice } from "@/lib/listing-types";
import { PaymentMethodModal } from "@/components/checkout/payment-method-modal";

interface ShippingMethodOption {
  id: string;
  carrier: string;
  serviceName: string;
  price: number;
  isSigned: boolean;
}

interface Props {
  listingId: string;
  listingTitle: string;
  unitPrice: number;
  shippingCost: number;
  freeShipping: boolean;
  available: number;
  shippingMethods: ShippingMethodOption[];
  availableBalance: number;
  // Fase 27.39: SHIP (verzending, default) of PICKUP_PLATFORM (ophalen +
  // vooraf via wallet). EXTERNAL pickup voor stocked listings loopt via
  // PickupReserveButton (quantity=1) — niet via dit component.
  deliveryChoice?: "SHIP" | "PICKUP_PLATFORM";
}

// Direct-buy-flow voor SEALED_PRODUCT en OTHER met stockQuantity. Toont een
// stepper voor "hoeveel?" + het rolling totaal en triggert buyListing met
// quantity. Verzending = één keer (niet × N) want de hele bestelling gaat
// als één pakket. Bij PICKUP_PLATFORM: geen shipping-picker, geen verzendkosten.
export function BuyQuantityForm({
  listingId,
  listingTitle,
  unitPrice,
  shippingCost: defaultShippingCost,
  freeShipping,
  available,
  shippingMethods,
  availableBalance,
  deliveryChoice = "SHIP",
}: Props) {
  const isPickup = deliveryChoice === "PICKUP_PLATFORM";
  const t = useTranslations("listing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(1);
  const [selectedShippingId, setSelectedShippingId] = useState<string>(
    shippingMethods[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // Eenmalig aankoop-vergrendel: zodra de transactie start blijft deze true
  // tot we navigeren — voorkomt dat een ge-router-refreshte modal opnieuw
  // gebruikt kan worden voor een tweede aankoop.
  const [submitted, setSubmitted] = useState(false);

  const selectedMethod = shippingMethods.find((m) => m.id === selectedShippingId) ?? null;
  const shippingCost = isPickup ? 0 : freeShipping ? 0 : selectedMethod?.price ?? defaultShippingCost;
  const itemSubtotal = unitPrice * quantity;
  const total = itemSubtotal + shippingCost;

  const setQty = (n: number) => setQuantity(Math.max(1, Math.min(n, available)));

  // Open de confirm-modal — zelfde patroon als cart-checkout. Pas op confirm
  // wordt buyListing aangeroepen.
  function handleBuyClick() {
    setError(null);
    setShowConfirmModal(true);
  }

  function handleConfirm() {
    if (submitted) return; // dubbel-klik / re-render guard
    setError(null);
    setSubmitted(true);
    startTransition(async () => {
      const result = await buyListing(
        listingId,
        isPickup ? undefined : selectedShippingId || undefined,
        quantity,
        deliveryChoice as DeliveryChoice
      );
      if (result.error) {
        // Fout: modal sluiten, melding inline + toast, lock vrijgeven zodat
        // de buyer kan corrigeren (bv. saldo aanvullen) en opnieuw proberen.
        setError(result.error);
        setShowConfirmModal(false);
        setSubmitted(false);
        toast.error(result.error);
      } else {
        // Succes: modal sluiten en navigeren naar /aankopen — analoog aan
        // cart-checkout. Voorkomt dat de modal her-bruikbaar wordt na een
        // succesvolle transactie. `submitted` blijft true tot navigatie.
        setShowConfirmModal(false);
        toast.success(t("buyQuantity.purchaseComplete"));
        router.push("/dashboard/aankopen");
      }
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

      {/* Shipping picker — only for SHIP, when seller offers methods */}
      {!isPickup && shippingMethods.length > 0 && !freeShipping && (
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
        {!isPickup && (
          <div className="flex justify-between text-muted-foreground">
            <span>{t("shippingCost")}</span>
            <span>{freeShipping ? t("freeShipping") : `€${shippingCost.toFixed(2)}`}</span>
          </div>
        )}
        {isPickup && (
          <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300">
            <MapPin className="h-3 w-3" /> {t("directBuy.pickupHint")}
          </div>
        )}
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
        onClick={handleBuyClick}
        disabled={pending || submitted || quantity < 1}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {isPickup ? <MapPin className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
        {pending || submitted
          ? "..."
          : isPickup
            ? t("directBuy.pickupShortLabel")
            : t("buyQuantity.buyNow")}
      </button>

      {/* Confirm-modal — zelfde modal als cart-checkout zodat de UI
          uniform is over alle koop-paden. `loading=submitted` houdt de
          confirm-knop in de modal disabled tijdens en na de transactie
          tot navigatie de hele page unmount. */}
      {showConfirmModal && (
        <PaymentMethodModal
          totalCost={total}
          availableBalance={availableBalance}
          onConfirm={handleConfirm}
          onCancel={() => !submitted && setShowConfirmModal(false)}
          loading={submitted}
          summary={
            <div className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    {quantity > 1 && (
                      <span className="text-muted-foreground">{quantity}× </span>
                    )}
                    {listingTitle}
                  </p>
                  {quantity > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {quantity} × €{unitPrice.toFixed(2)}
                    </p>
                  )}
                </div>
                <span className="font-medium text-foreground tabular-nums shrink-0">
                  €{itemSubtotal.toFixed(2)}
                </span>
              </div>
              {isPickup ? (
                <div className="rounded-md bg-blue-50 p-2 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                  {t("directBuy.pickupModalHint")}
                </div>
              ) : (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t("shippingCost")}{selectedMethod ? ` — ${selectedMethod.carrier} ${selectedMethod.serviceName}` : ""}</span>
                  <span className="tabular-nums">
                    {freeShipping ? t("freeShipping") : `€${shippingCost.toFixed(2)}`}
                  </span>
                </div>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
