"use client";

import { useTranslations } from "next-intl";
import type { CartShippingMethod } from "@/actions/cart";
import { Package, ShieldCheck, Shield, AlertTriangle } from "lucide-react";
import {
  requiresSignedShipping,
  recommendsSignedShipping,
  SIGNED_REQUIRED_THRESHOLD,
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

  // Filter methods available for buyer's country
  let available = methods.filter(
    (m) => m.countries.length === 0 || m.countries.includes(buyerCountry)
  );

  // If signed is required, only show signed methods
  if (signedRequired) {
    const signedMethods = available.filter((m) => m.isSigned);
    if (signedMethods.length > 0) {
      available = signedMethods;
    }
  }

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
          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium">{method.carrier}</span>
            <span className="text-muted-foreground"> — {method.serviceName}</span>
            {method.isSigned && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-purple-600 dark:text-purple-400">
                <ShieldCheck className="h-3 w-3" />
                {ts("signed")}
              </span>
            )}
            {method.isTracked && !method.isSigned && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                <Shield className="h-3 w-3" />
                {ts("tracked")}
              </span>
            )}
          </div>
          <span className="font-semibold whitespace-nowrap">&euro;{method.price.toFixed(2)}</span>
        </label>
      ))}
    </div>
  );
}
