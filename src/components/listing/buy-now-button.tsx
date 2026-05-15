"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ShoppingCart, AlertTriangle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { buyListing } from "@/actions/listing";
import type { DeliveryChoice } from "@/lib/listing-types";
import { PaymentMethodModal } from "@/components/checkout/payment-method-modal";

interface ShippingMethodOption {
  id: string;
  carrier: string;
  service: string; // ShippingService
  price: number;
}

interface Props {
  listingId: string;
  listingTitle: string;
  price: number;
  shippingCost: number;
  freeShipping: boolean;
  shippingMethods: ShippingMethodOption[];
  availableBalance: number;
  // Fase 27.39: bepaalt of dit een SHIP-aankoop is of een PICKUP_PLATFORM
  // (ophalen + vooraf betalen via wallet). Default SHIP voor backward compat.
  // PICKUP_PLATFORM verbergt de shipping-method-picker en knop-tekst toont
  // "Ophalen — vooraf betalen" i.p.v. "Direct Kopen".
  deliveryChoice?: "SHIP" | "PICKUP_PLATFORM";
}

// Direct-buy-knop voor non-stocked FIXED-listings (SINGLE_CARD, MULTI_CARD,
// COLLECTION). Vergelijkbaar met BuyQuantityForm maar zonder stepper — vast
// 1 stuks, hele listing wordt afgenomen. Gebruikt PaymentMethodModal voor
// uniforme confirm-UX. Submitted-lock voorkomt dubbele aankopen.
export function BuyNowButton({
  listingId,
  listingTitle,
  price,
  shippingCost: defaultShippingCost,
  freeShipping,
  shippingMethods,
  availableBalance,
  deliveryChoice = "SHIP",
}: Props) {
  const isPickup = deliveryChoice === "PICKUP_PLATFORM";
  const t = useTranslations("listing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedShippingId, setSelectedShippingId] = useState<string>(
    shippingMethods[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedMethod = shippingMethods.find((m) => m.id === selectedShippingId) ?? null;
  // Bij PICKUP_PLATFORM: geen shipping cost (koper haalt zelf op).
  const shippingCost = isPickup ? 0 : freeShipping ? 0 : selectedMethod?.price ?? defaultShippingCost;
  const total = price + shippingCost;

  function handleBuyClick() {
    setError(null);
    setShowConfirmModal(true);
  }

  function handleConfirm() {
    if (submitted) return;
    setError(null);
    setSubmitted(true);
    startTransition(async () => {
      const result = await buyListing(
        listingId,
        isPickup ? undefined : selectedShippingId || undefined,
        1,
        deliveryChoice as DeliveryChoice
      );
      if ("error" in result && result.error) {
        setError(result.error);
        setShowConfirmModal(false);
        setSubmitted(false);
        toast.error(result.error);
      } else {
        setShowConfirmModal(false);
        toast.success(t("buyQuantity.purchaseComplete"));
        router.push("/dashboard/aankopen");
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Shipping picker — alleen voor SHIP-aankopen, en alleen als seller
          methods aanbiedt en geen gratis verzending. PICKUP_PLATFORM verbergt
          deze hele sectie (geen verzendkosten). */}
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
                {m.carrier} {m.service} — €{m.price.toFixed(2)}
                {m.service === "PARCEL_SIGNED" ? " (aangetekend)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Total breakdown */}
      <div className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>{listingTitle}</span>
          <span>€{price.toFixed(2)}</span>
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
        disabled={pending || submitted}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {isPickup ? <MapPin className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
        {pending || submitted
          ? "..."
          : isPickup
            ? t("directBuy.pickupShortLabel")
            : `${t("directBuy.label")} €${price.toFixed(2)}`}
      </button>

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
                  <p className="font-medium text-foreground">{listingTitle}</p>
                </div>
                <span className="font-medium text-foreground tabular-nums shrink-0">
                  €{price.toFixed(2)}
                </span>
              </div>
              {isPickup ? (
                <div className="rounded-md bg-blue-50 p-2 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                  {t("directBuy.pickupModalHint")}
                </div>
              ) : (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>
                    {t("shippingCost")}
                    {selectedMethod ? ` — ${selectedMethod.carrier} ${selectedMethod.service}` : ""}
                  </span>
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
