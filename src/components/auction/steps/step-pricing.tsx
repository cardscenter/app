"use client";

import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { PricingInfoBlock } from "@/components/ui/pricing-info-block";
import type { CardPricingSnapshot } from "@/components/ui/card-search-select";

interface StepPricingProps {
  startingBid: number | null;
  duration: number;
  hasReserve: boolean;
  reservePrice: number | null;
  hasBuyNow: boolean;
  buyNowPrice: number | null;
  runnerUpEnabled: boolean;
  pricing?: CardPricingSnapshot | null;
  onChange: (field: string, value: unknown) => void;
}

const DURATIONS = [3, 5, 7, 14];

export function StepPricing({
  startingBid,
  duration,
  hasReserve,
  reservePrice,
  hasBuyNow,
  buyNowPrice,
  runnerUpEnabled,
  pricing,
  onChange,
}: StepPricingProps) {
  const t = useTranslations("auction");

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t("stepPricing")}</h2>

      {/* Market price — shows when a TCGdex card is picked */}
      {pricing && pricing.avg !== null && (
        <PricingInfoBlock pricing={pricing} variant="full" label="Marktwaarde (richtprijs)" />
      )}

      {/* Starting bid */}
      <div>
        <label htmlFor="startingBid" className="block text-sm font-medium text-foreground">{t("startingBid")}</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">&euro;</span>
          <input
            id="startingBid"
            type="number"
            step="0.01"
            min="0.01"
            value={startingBid ?? ""}
            onChange={(e) => onChange("startingBid", e.target.value ? parseFloat(e.target.value) : null)}
            className="block w-48 glass-input px-3 py-2.5 text-foreground"
          />
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t("duration")}</label>
        <div className="mt-2 flex flex-wrap gap-3">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange("duration", d)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all ${
                duration === d
                  ? "border-primary bg-primary text-white shadow-md"
                  : "glass-subtle text-foreground hover:bg-white/60 dark:hover:bg-white/10"
              }`}
            >
              <Clock className="h-4 w-4" />
              {d} {t("days")}
            </button>
          ))}
        </div>
      </div>

      {/* Reserve price */}
      <div className="glass-subtle rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-foreground">{t("reservePrice")}</span>
            <p className="text-xs text-muted-foreground mt-0.5">{t("reservePriceHelp")}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange("hasReserve", !hasReserve)}
            className={`relative h-6 w-11 rounded-full transition-colors ${hasReserve ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hasReserve ? "translate-x-5" : ""}`}
            />
          </button>
        </div>
        {hasReserve && (
          <div className="flex items-center gap-2 border-t border-border/50 pt-3">
            <span className="text-muted-foreground">&euro;</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={reservePrice ?? ""}
              onChange={(e) => onChange("reservePrice", e.target.value ? parseFloat(e.target.value) : null)}
              className="block w-48 glass-input px-3 py-2.5 text-foreground"
            />
          </div>
        )}
      </div>

      {/* Buy now price */}
      <div className="glass-subtle rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-foreground">{t("buyNowPrice")}</span>
            <p className="text-xs text-muted-foreground mt-0.5">{t("buyNowPriceHelp")}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange("hasBuyNow", !hasBuyNow)}
            className={`relative h-6 w-11 rounded-full transition-colors ${hasBuyNow ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hasBuyNow ? "translate-x-5" : ""}`}
            />
          </button>
        </div>
        {hasBuyNow && (
          <div className="flex items-center gap-2 border-t border-border/50 pt-3">
            <span className="text-muted-foreground">&euro;</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={buyNowPrice ?? ""}
              onChange={(e) => onChange("buyNowPrice", e.target.value ? parseFloat(e.target.value) : null)}
              className="block w-48 glass-input px-3 py-2.5 text-foreground"
            />
          </div>
        )}
      </div>

      {/* Runner-up rotation */}
      <div className="glass-subtle rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm font-medium text-foreground">{t("runnerUpEnabled")}</span>
            <p className="text-xs text-muted-foreground mt-0.5">{t("runnerUpEnabledHelp")}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange("runnerUpEnabled", !runnerUpEnabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${runnerUpEnabled ? "bg-primary" : "bg-muted"}`}
            aria-pressed={runnerUpEnabled}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${runnerUpEnabled ? "translate-x-5" : ""}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
