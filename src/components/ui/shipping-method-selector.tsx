"use client";

import { useTranslations } from "next-intl";
import { KNOWN_CARRIERS } from "@/lib/shipping/carriers";
import { Link } from "@/i18n/navigation";
import { AlertTriangle } from "lucide-react";
import { CarrierLogo } from "@/components/ui/carrier-logo";

/** Shape geleverd door `getSellerShippingMethods` (Fase 33). */
export interface EnrichedShippingMethod {
  id: string;
  service: string; // MAILBOX_PARCEL | PARCEL_STANDARD | PARCEL_SIGNED
  zone: string;    // DOMESTIC | EU_NEAR | EU_FAR
  carrier: string;
  basePrice: number;
  effectivePrice: number;
  priceOverride: number | null;
  isActive: boolean;
}

interface Props {
  methods: EnrichedShippingMethod[];
  selected: string[];
  onChange: (selected: string[]) => void;
  context?: "listing" | "claimsale" | "auction";
  freeShipping?: boolean;
}

export function ShippingMethodSelector({ methods, selected, onChange, context, freeShipping }: Props) {
  const t = useTranslations("shipping");

  function getCarrierName(carrierId: string) {
    return KNOWN_CARRIERS.find((c) => c.id === carrierId)?.name ?? carrierId;
  }

  const activeMethods = methods.filter((m) => m.isActive);

  if (activeMethods.length === 0) {
    return (
      <div className="glass-subtle rounded-2xl p-4 text-sm text-muted-foreground">
        <p>{t("noMethodsConfigured")}</p>
        <Link
          href="/dashboard/verzending"
          className="mt-2 inline-block text-primary hover:underline"
        >
          {t("methodsManageLink")}
        </Link>
      </div>
    );
  }

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  }

  const hasMailboxSelected = selected.some((id) => {
    const m = activeMethods.find((am) => am.id === id);
    return m?.service === "MAILBOX_PARCEL";
  });

  return (
    <div className="space-y-2">
      {activeMethods.map((method) => {
        const isSelected = selected.includes(method.id);
        const isMailbox = method.service === "MAILBOX_PARCEL";

        return (
          <label
            key={method.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
              isSelected
                ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
                : "border-border hover:bg-muted/30"
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggle(method.id)}
              className="mt-0.5 rounded border-border"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CarrierLogo carrierId={method.carrier} size={16} />
                  <span>{getCarrierName(method.carrier)} — {t(`service.${method.service}`)}</span>
                </div>
                <p className="text-sm font-medium text-primary">
                  {freeShipping ? (
                    <span className="text-green-600 dark:text-green-400">{t("free")}</span>
                  ) : (
                    <>€{method.effectivePrice.toFixed(2)}</>
                  )}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(`zone.${method.zone}`)}
              </p>
              {isMailbox && isSelected && context === "claimsale" && (
                <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{t("mailboxWarning")}</span>
                </div>
              )}
            </div>
          </label>
        );
      })}

      {hasMailboxSelected && context === "claimsale" && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t("mailboxWarningDetail")}</span>
        </div>
      )}
    </div>
  );
}
