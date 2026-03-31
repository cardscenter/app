"use client";

import { useTranslations } from "next-intl";
import type { CartShippingMethod } from "@/actions/cart";
import { Package } from "lucide-react";

interface ShippingMethodPickerProps {
  methods: CartShippingMethod[];
  buyerCountry: string;
  selected: string | null;
  onChange: (methodId: string) => void;
}

export function ShippingMethodPicker({ methods, buyerCountry, selected, onChange }: ShippingMethodPickerProps) {
  const ts = useTranslations("shipping");

  // Filter methods available for buyer's country
  const available = methods.filter(
    (m) => m.countries.length === 0 || m.countries.includes(buyerCountry)
  );

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
          </div>
          <span className="font-semibold whitespace-nowrap">&euro;{method.price.toFixed(2)}</span>
        </label>
      ))}
    </div>
  );
}
