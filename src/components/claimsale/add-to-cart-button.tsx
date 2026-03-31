"use client";

import { useTranslations } from "next-intl";
import { addToCart } from "@/actions/cart";
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
  const t = useTranslations("cart");
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAdd() {
    setLoading(true);
    const result = await addToCart(itemId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(t("itemAdded", { name: cardName }));
      setAdded(true);
      window.dispatchEvent(new CustomEvent("cart-updated"));
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleAdd}
      disabled={loading || added}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        added
          ? "bg-muted text-muted-foreground0 cursor-default"
          : "bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      }`}
    >
      {added ? (
        <>
          <Check className="h-3.5 w-3.5" />
          {t("addedToCart")}
        </>
      ) : (
        <>
          <ShoppingCart className="h-3.5 w-3.5" />
          {loading ? "..." : t("addToCart")}
        </>
      )}
    </button>
  );
}
