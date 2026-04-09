"use client";

import { useTranslations } from "next-intl";
import { claimItem } from "@/actions/claimsale";
import { useOptimistic, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const [optimisticClaimed, setOptimisticClaimed] = useOptimistic(false);

  function handleClaim() {
    startTransition(async () => {
      setOptimisticClaimed(true);
      const result = await claimItem(itemId);
      if (result?.error) {
        setOptimisticClaimed(false);
        toast.error(result.error);
      } else {
        toast.success(t("claimSuccess", { name: cardName }));
        window.dispatchEvent(new CustomEvent("cart-updated"));
      }
    });
  }

  return (
    <button
      onClick={handleClaim}
      disabled={isPending || optimisticClaimed}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        optimisticClaimed
          ? "bg-muted text-muted-foreground cursor-default"
          : "bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      }`}
    >
      {optimisticClaimed ? (
        <>
          <Check className="h-3.5 w-3.5" />
          {t("claimed")}
        </>
      ) : (
        <>
          <ShoppingCart className="h-3.5 w-3.5" />
          {t("claim")}
        </>
      )}
    </button>
  );
}
