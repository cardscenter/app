"use client";

import { useTranslations } from "next-intl";
import { Trash2, ImageIcon } from "lucide-react";
import { removeFromCart } from "@/actions/cart";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CartItemRowProps {
  cartItemId: string;
  cardName: string;
  condition: string;
  price: number;
  cardSetName: string;
  imageUrls: string[];
  status: string;
}

export function CartItemRow({
  cartItemId,
  cardName,
  condition,
  price,
  cardSetName,
  imageUrls,
  status,
}: CartItemRowProps) {
  const t = useTranslations("cart");
  const [removing, setRemoving] = useState(false);
  const router = useRouter();

  async function handleRemove() {
    setRemoving(true);
    const result = await removeFromCart(cartItemId);
    if (result?.error) {
      toast.error(result.error);
      setRemoving(false);
    } else {
      toast.success(t("itemRemoved"));
      window.dispatchEvent(new CustomEvent("cart-updated"));
      router.refresh();
    }
  }

  const isUnavailable = status !== "AVAILABLE";

  return (
    <div className={`flex items-center gap-4 py-3 ${isUnavailable ? "opacity-50" : ""}`}>
      {/* Thumbnail */}
      {imageUrls.length > 0 ? (
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          <img
            src={imageUrls[0]}
            alt={cardName}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
          <ImageIcon className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
        </div>
      )}

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
          {cardName}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {cardSetName} · {condition}
        </p>
        {isUnavailable && (
          <p className="text-xs font-medium text-red-500">{t("claimedByOther")}</p>
        )}
      </div>

      {/* Price */}
      <p className="shrink-0 font-medium text-zinc-900 dark:text-zinc-50">
        &euro;{price.toFixed(2)}
      </p>

      {/* Remove */}
      <button
        onClick={handleRemove}
        disabled={removing}
        className="shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 disabled:opacity-50"
        title={t("remove")}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
