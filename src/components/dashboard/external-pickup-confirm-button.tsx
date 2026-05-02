"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { confirmExternalPickup } from "@/actions/pickup";

interface Props {
  shippingBundleId: string;
}

// Koper-confirm knop voor EXTERNAL pickup (Fase 27.42). Hoort in
// ActivePickupsSection naast de bundle-info. Geen modal — confirm-dialog
// is genoeg want er staat geen wallet-bedrag op het spel (EXTERNAL =
// koper betaalt aan seller bij ophalen, platform doet alleen state-flip).
export function ExternalPickupConfirmButton({ shippingBundleId }: Props) {
  const t = useTranslations("pickup");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    if (!confirm(t("confirmExternalDialog"))) return;
    startTransition(async () => {
      const result = await confirmExternalPickup(shippingBundleId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("completed"));
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
    >
      <Check className="h-4 w-4" />
      {t("confirmExternalButton")}
    </button>
  );
}
