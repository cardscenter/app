"use client";

import { useTranslations } from "next-intl";
import type { CartShippingMethod } from "@/actions/cart";
import { ShieldCheck, Shield, AlertTriangle } from "lucide-react";
import { CarrierLogo } from "@/components/ui/carrier-logo";
import {
  requiresSignedShipping,
  recommendsSignedShipping,
  SIGNED_REQUIRED_THRESHOLD,
  isUntrackedAllowed,
  UNTRACKED_MAX_ORDER_VALUE,
} from "@/lib/shipping/tracked-threshold";

interface ShippingMethodPickerProps {
  methods: CartShippingMethod[];
  buyerCountry: string;
  sellerCountry?: string;
  itemTotal?: number;
  selected: string | null;
  onChange: (methodId: string) => void;
}

export function ShippingMethodPicker({
  methods,
  buyerCountry,
  sellerCountry,
  itemTotal = 0,
  selected,
  onChange,
}: ShippingMethodPickerProps) {
  const ts = useTranslations("shipping");

  const isInternational = !!sellerCountry && sellerCountry !== buyerCountry;
  const signedRequired = requiresSignedShipping(itemTotal, isInternational);
  const signedRecommended = !signedRequired && recommendsSignedShipping(itemTotal);
  const untrackedAllowed = isUntrackedAllowed(itemTotal);

  // Filter methods available for buyer's country
  let available = methods.filter(
    (m) => m.countries.length === 0 || m.countries.includes(buyerCountry)
  );

  // If untracked not allowed (>= €25), filter out untracked methods
  if (!untrackedAllowed) {
    const trackedMethods = available.filter((m) => m.isTracked);
    if (trackedMethods.length > 0) {
      available = trackedMethods;
    }
  }

  // If signed is required, only show signed methods
  if (signedRequired) {
    const signedMethods = available.filter((m) => m.isSigned);
    if (signedMethods.length > 0) {
      available = signedMethods;
    }
  }

  // Check if user selected an untracked method (for warning)
  const selectedMethod = available.find((m) => m.id === selected);
  const showBriefpostWarning = untrackedAllowed && selectedMethod && !selectedMethod.isTracked;

  if (available.length === 0) {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-400">
        {ts("noMethodsForCountry")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{ts("chooseShippingMethod")}</p>

      {/* Signed shipping notices */}
      {signedRequired && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {isInternational
              ? ts("signedRequiredInternational")
              : ts("signedRequiredThreshold", { amount: SIGNED_REQUIRED_THRESHOLD })}
          </span>
        </div>
      )}
      {signedRecommended && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{ts("signedRecommended")}</span>
        </div>
      )}
      {!untrackedAllowed && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-2.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{ts("briefpostNotAllowed", { amount: UNTRACKED_MAX_ORDER_VALUE })}</span>
        </div>
      )}
      {showBriefpostWarning && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{ts("briefpostWarning")}</span>
        </div>
      )}

      {available.map((method) => (
        <label
          key={method.id}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${
            selected === method.id
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-border"
          }`}
        >
          <input
            type="radio"
            name={`shipping-${method.id}`}
            checked={selected === method.id}
            onChange={() => onChange(method.id)}
            className="sr-only"
          />
          <CarrierLogo carrierId={method.carrier} size={32} className="shrink-0 rounded" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium">{method.carrier} — {method.serviceName}</span>
              <span className="font-semibold whitespace-nowrap">&euro;{method.price.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {method.isSigned && (
                <span className="inline-flex items-center gap-0.5 text-xs text-purple-600 dark:text-purple-400">
                  <ShieldCheck className="h-3 w-3" />
                  {ts("signed")}
                </span>
              )}
              {method.isTracked && !method.isSigned && (
                <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                  <Shield className="h-3 w-3" />
                  {ts("tracked")}
                </span>
              )}
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}
