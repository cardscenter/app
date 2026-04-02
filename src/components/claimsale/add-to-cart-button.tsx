"use client";

import { useTranslations } from "next-intl";
import { claimItem } from "@/actions/claimsale";
import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { toast } from "sonner";

export function AddToCartButton({
  itemId,
  cardName,
}: {
  itemId: string;
  cardName: string;
}) {
  const t = useTranslations("claimsale");
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);

  async function handleClaim() {
    setLoading(true);
    const result = await claimItem(itemId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(t("claimSuccess", { name: cardName }));
      setClaimed(true);
      window.dispatchEvent(new CustomEvent("cart-updated"));
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleClaim}
      disabled={loading || claimed}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        claimed
          ? "bg-muted text-muted-foreground cursor-default"
          : "bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      }`}
    >
      {claimed ? (
        <>
          <Check className="h-3.5 w-3.5" />
          {t("claimed")}
        </>
      ) : (
        <>
          <ShoppingCart className="h-3.5 w-3.5" />
          {loading ? "..." : t("claim")}
        </>
      )}
    </button>
  );
}