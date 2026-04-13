"use client";

import { useTranslations } from "next-intl";
import { PricingInfoBlock } from "@/components/ui/pricing-info-block";
import type { CardPricingSnapshot } from "@/components/ui/card-search-select";

interface StepPricingProps {
  pricingType: string;
  price: number | null;
  pricing?: CardPricingSnapshot | null;
  onChange: (field: string, value: unknown) => void;
}

export function StepPricing({ pricingType, price, pricing, onChange }: StepPricingProps) {
  const t = useTranslations("listing");

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-foreground">{t("stepPricing")}</h2>

      {/* Pricing type */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t("pricingType")}</label>
        <div className="mt-2 flex gap-3">
          {[
            { value: "FIXED", label: t("fixedPrice") },
            { value: "NEGOTIABLE", label: t("negotiable") },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange("pricingType", opt.value)}
              className={`rounded-xl border px-5 py-2.5 text-sm transition-all ${
                pricingType === opt.value
                  ? "border-primary bg-primary text-white shadow-md"
                  : "glass-subtle text-foreground hover:bg-white/60 dark:hover:bg-white/10"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* CardMarket suggested price — shows when a TCGdex card is picked */}
      {pricing && pricing.avg !== null && (
        <PricingInfoBlock pricing={pricing} variant="full" label="CardMarket-prijs (richtprijs)" />
      )}

      {/* Price input (only for FIXED) */}
      {pricingType === "FIXED" && (
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-foreground">{t("price")}</label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground">&euro;</span>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0.01"
              value={price ?? ""}
              onChange={(e) => onChange("price", e.target.value ? parseFloat(e.target.value) : null)}
              className="block w-48 glass-input px-3 py-2.5 text-foreground"
            />
          </div>
        </div>
      )}
    </div>
  );
}
