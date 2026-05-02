"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { buyListing } from "@/actions/listing";
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
  price: number;
  shippingCost: number;
  freeShipping: boolean;
  shippingMethods: ShippingMethodOption[];
  availableBalance: number;
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
}: Props) {
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
  const shippingCost = freeShipping ? 0 : selectedMethod?.price ?? defaultShippingCost;
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
      const result = await buyListing(listingId, selectedShippingId || undefined, 1);
      if (result.error) {
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
      {/* Shipping picker — alleen als seller methods aanbiedt en geen
          gratis verzending. Bij gratis verzending of geen methods: buy-knop
          gebruikt de listing-default. */}
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
          <span>{listingTitle}</span>
          <span>€{price.toFixed(2)}</span>
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
        onClick={handleBuyClick}
        disabled={pending || submitted}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        <ShoppingCart className="h-4 w-4" />
        {pending || submitted ? "..." : `${t("directBuy.label")} €${price.toFixed(2)}`}
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
              <div className="flex items-center justify-between text-muted-foreground">
                <span>
                  {t("shippingCost")}
                  {selectedMethod ? ` — ${selectedMethod.carrier} ${selectedMethod.serviceName}` : ""}
                </span>
                <span className="tabular-nums">
                  {freeShipping ? t("freeShipping") : `€${shippingCost.toFixed(2)}`}
                </span>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
