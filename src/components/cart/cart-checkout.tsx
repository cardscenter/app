"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { checkout } from "@/actions/cart";
import { toast } from "sonner";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";

interface CartCheckoutProps {
  totalCost: number;
  shippingSelections: Record<string, string>;
  hasAddress: boolean;
  requiresMethodSelection: boolean;
}

export function CartCheckout({ totalCost, shippingSelections, hasAddress, requiresMethodSelection }: CartCheckoutProps) {
  const t = useTranslations("cart");
  const ts = useTranslations("shipping");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Check if all required selections are made
  const allMethodsSelected = !requiresMethodSelection || Object.keys(shippingSelections).length > 0;

  async function handleCheckout() {
    if (!hasAddress) {
      toast.error(ts("addressRequired"));
      return;
    }

    setLoading(true);
    const result = await checkout(shippingSelections);

    if (result?.error === "NO_ADDRESS") {
      toast.error(ts("addressRequired"));
      setLoading(false);
      return;
    }

    if (result?.error && !result.conflictedItems) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    // Show conflicts
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
      router.refresh();
    } else {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
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
        onClick={handleCheckout}
        disabled={loading || totalCost === 0 || !hasAddress || !allMethodsSelected}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        <ShoppingCart className="h-4 w-4" />
        {loading ? "..." : `${t("checkout")} — €${totalCost.toFixed(2)}`}
      </button>
    </div>
  );
}
