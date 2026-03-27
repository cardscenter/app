"use client";

import { useTranslations } from "next-intl";
import { Star, TrendingUp, Zap } from "lucide-react";
import { UPSELL_PRICING, calculateUpsellCost, PREMIUM_UPSELL_DISCOUNT } from "@/lib/upsell-config";
import { UPSELL_TYPES } from "@/types";
import type { UpsellType } from "@/types";

interface UpsellEntry {
  type: UpsellType;
  days: number;
}

interface StepUpsellsProps {
  upsells: UpsellEntry[];
  userBalance: number;
  isPremium: boolean;
  onChange: (upsells: UpsellEntry[]) => void;
}

const UPSELL_ICONS: Record<UpsellType, typeof Star> = {
  HOMEPAGE_SPOTLIGHT: Star,
  CATEGORY_HIGHLIGHT: TrendingUp,
  URGENT_LABEL: Zap,
};

const UPSELL_KEYS: Record<UpsellType, { label: string; desc: string }> = {
  HOMEPAGE_SPOTLIGHT: { label: "upsellSpotlight", desc: "upsellSpotlightDesc" },
  CATEGORY_HIGHLIGHT: { label: "upsellHighlight", desc: "upsellHighlightDesc" },
  URGENT_LABEL: { label: "upsellUrgent", desc: "upsellUrgentDesc" },
};

export function StepUpsells({ upsells, userBalance, isPremium, onChange }: StepUpsellsProps) {
  const t = useTranslations("listing");

  const toggleUpsell = (type: UpsellType) => {
    const existing = upsells.find((u) => u.type === type);
    if (existing) {
      onChange(upsells.filter((u) => u.type !== type));
    } else {
      onChange([...upsells, { type, days: UPSELL_PRICING[type].minDays }]);
    }
  };

  const updateDays = (type: UpsellType, days: number) => {
    onChange(upsells.map((u) => (u.type === type ? { ...u, days } : u)));
  };

  const totalCost = upsells.reduce(
    (sum, entry) => sum + calculateUpsellCost(entry.type, entry.days, isPremium),
    0
  );
  const remainingBalance = userBalance - totalCost;
  const insufficientBalance = remainingBalance < 0;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-foreground">{t("stepUpsells")}</h2>

      {/* Upsell cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {UPSELL_TYPES.map((type) => {
          const Icon = UPSELL_ICONS[type];
          const keys = UPSELL_KEYS[type];
          const config = UPSELL_PRICING[type];
          const active = upsells.find((u) => u.type === type);
          const dailyCost = isPremium
            ? config.dailyCost * (1 - PREMIUM_UPSELL_DISCOUNT)
            : config.dailyCost;

          return (
            <div
              key={type}
              className={`rounded-2xl border-2 p-4 transition-all ${
                active
                  ? "border-primary bg-primary/5"
                  : "glass-subtle border-transparent"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleUpsell(type)}
                className="flex w-full items-start gap-3 text-left"
              >
                <div className={`rounded-lg p-2 ${active ? "bg-primary/10" : "bg-muted"}`}>
                  <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">{t(keys.label)}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t(keys.desc)}</div>
                  <div className="mt-1 text-sm font-semibold text-primary">
                    &euro;{dailyCost.toFixed(2)}{t("upsellPerDay")}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!active}
                  readOnly
                  className="mt-1 h-4 w-4 accent-primary"
                />
              </button>

              {/* Day selector */}
              {active && (
                <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                  <label className="text-xs text-muted-foreground">Dagen:</label>
                  <input
                    type="range"
                    min={config.minDays}
                    max={config.maxDays}
                    value={active.days}
                    onChange={(e) => updateDays(type, parseInt(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="min-w-[3rem] text-right text-sm font-medium text-foreground">
                    {active.days}d
                  </span>
                  <span className="text-xs text-muted-foreground">
                    = &euro;{calculateUpsellCost(type, active.days, isPremium).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Premium discount notice */}
      {isPremium && (
        <div className="glass-subtle rounded-xl p-3 text-sm text-primary">
          ✨ {t("premiumDiscount")}
        </div>
      )}

      {/* Cost summary */}
      <div className="glass-subtle rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("upsellTotal")}</span>
          <span className="font-semibold text-foreground">&euro;{totalCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("currentBalance")}</span>
          <span className="text-foreground">&euro;{userBalance.toFixed(2)}</span>
        </div>
        <div className="border-t border-border/50 pt-2 flex justify-between text-sm">
          <span className="text-muted-foreground">{t("remainingBalance")}</span>
          <span className={`font-semibold ${insufficientBalance ? "text-red-500" : "text-foreground"}`}>
            &euro;{remainingBalance.toFixed(2)}
          </span>
        </div>
        {insufficientBalance && (
          <div className="text-xs text-red-500 mt-1">{t("insufficientBalance")}</div>
        )}
      </div>
    </div>
  );
}
