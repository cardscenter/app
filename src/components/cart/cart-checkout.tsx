"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { checkout } from "@/actions/cart";
import { toast } from "sonner";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { PaymentMethodModal } from "@/components/checkout/payment-method-modal";

// Aantal minuten dat de checkout-lock op claimsale-items staat — moet matchen
// met de waarde in src/actions/cart.ts checkout(). Als je daar de TTL wijzigt,
// pas hier ook aan voor een correcte UI-melding.
const CHECKOUT_LOCK_MINUTES = 5;

interface CartCheckoutProps {
  totalCost: number;
  shippingSelections: Record<string, string>;
  mergeIntoBundles: Record<string, string>;
  hasAddress: boolean;
  requiresMethodSelection: boolean;
  availableBalance: number;
}

export function CartCheckout({ totalCost, shippingSelections, mergeIntoBundles, hasAddress, requiresMethodSelection, availableBalance }: CartCheckoutProps) {
  const t = useTranslations("cart");
  const ts = useTranslations("shipping");
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const router = useRouter();

  const allMethodsSelected = !requiresMethodSelection || Object.keys(shippingSelections).length > 0;

  // Pauzeer / hervat de countdown-timers op cart-item-rows. Bij modal-open
  // pauzeren ("vastgezet" tot betaling klaar is), bij cancel/close hervatten.
  // Eventuele subscribers (CartItemRow) listen op deze events.
  useEffect(() => {
    if (showPaymentModal) {
      window.dispatchEvent(new CustomEvent("cart-checkout-locked"));
    } else {
      window.dispatchEvent(new CustomEvent("cart-checkout-unlocked"));
    }
  }, [showPaymentModal]);

  async function handleCheckout() {
    setLoading(true);
    const result = await checkout(shippingSelections, mergeIntoBundles);

    if (result?.error === "NO_ADDRESS") {
      toast.error(ts("addressRequired"));
      setLoading(false);
      setShowPaymentModal(false);
      return;
    }

    if (result?.error && !result.conflictedItems) {
      toast.error(result.error);
      setLoading(false);
      setShowPaymentModal(false);
      return;
    }

    if (result.conflictedItems && result.conflictedItems.length > 0) {
      for (const item of result.conflictedItems) {
        toast.warning(t("conflictMessage", { name: item.cardName }));
      }
    }

    if (result.success && result.claimedCount > 0) {
      toast.success(t("checkoutSuccess", { count: result.claimedCount }));
      router.push("/dashboard/aankopen");
    } else if (result.success && result.claimedCount === 0) {
      toast.error(t("claimedByOther"));
      setShowPaymentModal(false);
      setLoading(false);
      router.refresh();
    } else {
      setShowPaymentModal(false);
      setLoading(false);
      router.refresh();
    }
  }

  function handleCheckoutClick() {
    if (!hasAddress) {
      toast.error(ts("addressRequired"));
      return;
    }
    setShowPaymentModal(true);
  }

  return (
    <div className="space-y-3">
      {showPaymentModal && (
        <PaymentMethodModal
          totalCost={totalCost}
          availableBalance={availableBalance}
          onConfirm={handleCheckout}
          onCancel={() => setShowPaymentModal(false)}
          loading={loading}
          checkoutLockMinutes={CHECKOUT_LOCK_MINUTES}
        />
      )}

      {!hasAddress && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50/80 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p>{ts("addressRequired")}</p>
            <Link href="/dashboard/verzending" className="font-medium underline">
              {ts("addAddress")}
            </Link>
          </div>
        </div>
      )}
      <button
        onClick={handleCheckoutClick}
        disabled={loading || totalCost === 0 || !hasAddress || !allMethodsSelected}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        <ShoppingCart className="h-4 w-4" />
        {loading ? "..." : `${t("checkout")} — €${totalCost.toFixed(2)}`}
      </button>
    </div>
  );
}