"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { MapPin, AlertTriangle, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { buyListing } from "@/actions/listing";

interface Props {
  listingId: string;
  listingTitle: string;
  price: number;
  // Voor stocked SEALED/OTHER listings: aantal AVAILABLE rijen.
  // Bij > 1 verschijnt een quantity-stepper. Default 1 voor non-stocked.
  available?: number;
}

// Reserveer-knop voor EXTERNAL pickup (Fase 27.39 + 27.63 stepper).
// Geen wallet, geen modal — koper bevestigt simpelweg dat hij wilt reserveren.
// Listing → RESERVED, bundle PENDING+EXTERNAL. Bij stocked listings + available>1
// verschijnt een quantity-stepper zodat dezelfde flow geldt als andere routes.
export function PickupReserveButton({ listingId, listingTitle, price, available = 1 }: Props) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const total = price * quantity;
  const setQty = (n: number) => setQuantity(Math.max(1, Math.min(n, available)));

  function handleReserve() {
    if (!confirm(t("pickupReserve.confirmDialog", { title: listingTitle }))) return;
    setError(null);
    setConfirmed(true);
    startTransition(async () => {
      const result = await buyListing(listingId, undefined, quantity, "PICKUP_EXTERNAL");
      if ("error" in result && result.error) {
        setError(result.error);
        setConfirmed(false);
        toast.error(result.error);
      } else {
        toast.success(t("pickupReserve.reserved"));
        router.push("/dashboard/aankopen");
      }
    });
  }

  return (
    <div className="space-y-2">
      {/* Quantity-stepper alleen bij stocked listings met meer dan 1 voorraad */}
      {available > 1 && (
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
      )}

      <div className="text-sm text-foreground">
        {quantity > 1 ? (
          <>
            <span className="font-semibold">€{total.toFixed(2)}</span>{" "}
            <span className="text-muted-foreground">
              ({quantity} × €{price.toFixed(2)}) — {t("pickupReserve.payAtPickup")}
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold">€{price.toFixed(2)}</span>{" "}
            <span className="text-muted-foreground">— {t("pickupReserve.payAtPickup")}</span>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleReserve}
        disabled={pending || confirmed}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-amber-700 disabled:opacity-50"
      >
        <MapPin className="h-5 w-5" />
        {pending || confirmed ? "..." : t("pickupReserve.button")}
      </button>
    </div>
  );
}
