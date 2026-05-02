"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { MapPin, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { buyListing } from "@/actions/listing";

interface Props {
  listingId: string;
  listingTitle: string;
  price: number;
}

// Reserveer-knop voor EXTERNAL pickup (Fase 27.39). Geen wallet, geen modal —
// koper bevestigt simpelweg dat hij wilt reserveren. Listing → RESERVED, bundle
// PENDING+EXTERNAL met 14d-cron-timeout. Koper betaalt aan seller bij ophalen
// (Tikkie/contant). Afspraken-flow via chat (PickupActions in bundle-bubble).
export function PickupReserveButton({ listingId, listingTitle, price }: Props) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function handleReserve() {
    if (!confirm(t("pickupReserve.confirmDialog", { title: listingTitle }))) return;
    setError(null);
    setConfirmed(true);
    startTransition(async () => {
      const result = await buyListing(listingId, undefined, 1, "PICKUP_EXTERNAL");
      if (result.error) {
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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{t("pickupReserve.headline", { price: price.toFixed(2) })}</p>
            <p className="mt-0.5 opacity-90">{t("pickupReserve.hint")}</p>
          </div>
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
        onClick={handleReserve}
        disabled={pending || confirmed}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-900 shadow-sm transition-colors hover:bg-amber-200 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/30"
      >
        <MapPin className="h-4 w-4" />
        {pending || confirmed ? "..." : t("pickupReserve.button")}
      </button>
    </div>
  );
}
