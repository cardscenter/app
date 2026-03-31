"use client";

import { useTranslations, useLocale } from "next-intl";
import { getCountryName } from "@/lib/shipping/countries";
import { KNOWN_CARRIERS } from "@/lib/shipping/carriers";
import { Link } from "@/i18n/navigation";
import type { SellerShippingMethod } from "@prisma/client";

interface Props {
  methods: SellerShippingMethod[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function ShippingMethodSelector({ methods, selected, onChange }: Props) {
  const t = useTranslations("shipping");
  const locale = useLocale();

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
          {t("addMethod")}
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

  return (
    <div className="space-y-2">
      {activeMethods.map((method) => {
        const countries: string[] = JSON.parse(method.countries);
        const isSelected = selected.includes(method.id);

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
                <p className="text-sm font-medium text-foreground">
                  {getCarrierName(method.carrier)} — {method.serviceName}
                </p>
                <p className="text-sm font-medium text-primary">
                  €{method.price.toFixed(2)}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {countries.map((c) => getCountryName(c, locale)).join(", ")}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
