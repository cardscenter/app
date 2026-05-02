"use client";

import { useTranslations } from "next-intl";
import { PricingInfoBlock } from "@/components/ui/pricing-info-block";
import type { CardPricingSnapshot } from "@/components/ui/card-search-select";

interface StepPricingProps {
  pricingType: string;
  price: number | null;
  suggestedPrice: number | null;
  allowDirectBuy: boolean;
  acceptsOffers: boolean;
  pricing?: CardPricingSnapshot | null;
  onChange: (field: string, value: unknown) => void;
}

export function StepPricing({
  pricingType,
  price,
  suggestedPrice,
  allowDirectBuy,
  acceptsOffers,
  pricing,
  onChange,
}: StepPricingProps) {
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
                  : "glass-subtle text-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Market price — shows when a TCGdex card is picked */}
      {pricing && pricing.avg !== null && (
        <PricingInfoBlock pricing={pricing} variant="full" label="Marktwaarde (richtprijs)" />
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

      {/* Suggested price (only for NEGOTIABLE) — geeft koper een richtbedrag.
          Niet bindend; biedingen mogen lager of hoger. */}
      {pricingType === "NEGOTIABLE" && (
        <div>
          <label htmlFor="suggestedPrice" className="block text-sm font-medium text-foreground">
            {t("suggestedPrice.label")}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground">&euro;</span>
            <input
              id="suggestedPrice"
              type="number"
              step="0.01"
              min="0.01"
              value={suggestedPrice ?? ""}
              onChange={(e) =>
                onChange("suggestedPrice", e.target.value ? parseFloat(e.target.value) : null)
              }
              className="block w-48 glass-input px-3 py-2.5 text-foreground"
              placeholder="Optioneel"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("suggestedPrice.hint")}</p>
        </div>
      )}

      {/* Koop-opties (Fase 27.31) — toggles voor wat een koper mag doen.
          Alleen relevant bij FIXED: sellers kunnen Direct Kopen uitzetten
          als ze alleen biedingen willen, of biedingen blokkeren als ze
          vasthouden aan hun vraagprijs. */}
      {pricingType === "FIXED" && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">{t("buyOptions.title")}</h3>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowDirectBuy}
              onChange={(e) => onChange("allowDirectBuy", e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{t("buyOptions.allowDirectBuy.label")}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("buyOptions.allowDirectBuy.hint")}</p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptsOffers}
              onChange={(e) => onChange("acceptsOffers", e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{t("buyOptions.acceptsOffers.label")}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("buyOptions.acceptsOffers.hint")}</p>
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
