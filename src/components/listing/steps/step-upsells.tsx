"use client";

import { useTranslations } from "next-intl";
import { Star, TrendingUp, Gift } from "lucide-react";
import {
  UPSELL_PRICING,
  LISTING_UPSELL_TYPES_OFFERED,
  applyFreeUpsellsToCost,
  SPOTLIGHT_CTR_MULTIPLIER,
  CATEGORY_HIGHLIGHT_CTR_MULTIPLIER,
} from "@/lib/upsell-config";
import { getUpsellDiscount } from "@/lib/subscription-tiers";
import type { UpsellType } from "@/types";

interface UpsellEntry {
  type: UpsellType;
  days: number;
}

interface StepUpsellsProps {
  upsells: UpsellEntry[];
  userBalance: number;
  accountType: string;
  freeUpsellsRemaining: number;
  onUpsellsChange: (upsells: UpsellEntry[]) => void;
}

const UPSELL_ICONS: Record<UpsellType, typeof Star> = {
  HOMEPAGE_SPOTLIGHT: Star,
  CATEGORY_HIGHLIGHT: TrendingUp,
  URGENT_LABEL: Star, // niet aangeboden
};

const UPSELL_KEYS: Record<UpsellType, { label: string; desc: string }> = {
  HOMEPAGE_SPOTLIGHT: { label: "upsellSpotlight", desc: "upsellSpotlightDesc" },
  CATEGORY_HIGHLIGHT: { label: "upsellHighlight", desc: "upsellHighlightDesc" },
  URGENT_LABEL: { label: "upsellUrgent", desc: "upsellUrgentDesc" },
};

function defaultDays(type: UpsellType): number {
  return UPSELL_PRICING[type].minDays;
}

export function StepUpsells({
  upsells,
  userBalance,
  accountType,
  freeUpsellsRemaining,
  onUpsellsChange,
}: StepUpsellsProps) {
  const t = useTranslations("listing");
  const discount = getUpsellDiscount(accountType);
  const hasDiscount = discount > 0;

  const toggleUpsell = (type: UpsellType) => {
    const existing = upsells.find((u) => u.type === type);
    if (existing) {
      onUpsellsChange(upsells.filter((u) => u.type !== type));
    } else {
      onUpsellsChange([...upsells, { type, days: defaultDays(type) }]);
    }
  };

  const updateDays = (type: UpsellType, days: number) => {
    onUpsellsChange(
      upsells.map((u) => (u.type === type ? { ...u, days } : u))
    );
  };

  const allocation = applyFreeUpsellsToCost(
    upsells.map((u) => ({ type: u.type, days: u.days })),
    accountType,
    freeUpsellsRemaining,
    "listing"
  );
  const upsellCost = allocation.total;
  const totalCost = upsellCost;
  const remainingBalance = userBalance - totalCost;
  const insufficientBalance = remainingBalance < 0;
  const freeQuotaLeft = freeUpsellsRemaining - allocation.freeUsed;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("promotionTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("promotionDescription")}</p>
      </div>

      {/* Verticale stack — spiegel van de auction-promotie-sectie */}
      <div className="space-y-3">
        {LISTING_UPSELL_TYPES_OFFERED.map((type) => {
          const Icon = UPSELL_ICONS[type];
          const keys = UPSELL_KEYS[type];
          const config = UPSELL_PRICING[type];
          const active = upsells.find((u) => u.type === type);
          const dailyCost = config.dailyCost * (1 - discount);
          const idx = upsells.findIndex((u) => u.type === type);
          const entryCost = idx >= 0 ? allocation.perEntry[idx] : 0;
          const isFree =
            idx >= 0 && entryCost === 0 && type === "HOMEPAGE_SPOTLIGHT";
          const days = active ? active.days : 0;
          const ctrMultiplier =
            type === "HOMEPAGE_SPOTLIGHT"
              ? SPOTLIGHT_CTR_MULTIPLIER
              : CATEGORY_HIGHLIGHT_CTR_MULTIPLIER;
          const surfaceLabel =
            type === "HOMEPAGE_SPOTLIGHT" ? "homepage" : "categorie";

          return (
            <div
              key={type}
              className={`rounded-2xl border-2 p-4 transition-all ${
                active ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleUpsell(type)}
                className="flex w-full items-start gap-3 text-left"
              >
                <div className={`rounded-lg p-2 ${active ? "bg-primary/10" : "bg-muted"}`}>
                  <Icon
                    className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{t(keys.label)}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {t("labelCtrUplift", { n: ctrMultiplier })}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t(keys.desc)}</div>
                  <div className="mt-1 text-sm font-semibold text-primary">
                    €{dailyCost.toFixed(2)}{t("upsellPerDay")}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!active}
                  readOnly
                  className="mt-1 h-4 w-4 accent-primary"
                />
              </button>

              {active && (
                <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Op {surfaceLabel} zichtbaar voor{" "}
                      <span className="font-semibold text-foreground">{days}</span>{" "}
                      {days === 1 ? "dag" : "dagen"}
                    </span>
                    {isFree ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                        <Gift className="h-3 w-3" />
                        Gratis
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">
                        €{entryCost.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <input
                    type="range"
                    min={config.minDays}
                    max={config.maxDays}
                    value={days}
                    onChange={(e) => updateDays(type, parseInt(e.target.value, 10))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{config.minDays}d</span>
                    <span>{config.maxDays}d</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

      </div>

      {freeUpsellsRemaining > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
          <span className="inline-flex items-center gap-1.5">
            <Gift className="h-4 w-4" />
            Je hebt nog {freeQuotaLeft} van {freeUpsellsRemaining} gratis
            Homepage-spotlight{freeUpsellsRemaining === 1 ? "" : "s"} deze maand.
          </span>
        </div>
      )}

      {hasDiscount && (
        <div className="rounded-xl border border-border bg-card p-3 text-sm text-primary">
          {t("upsellDeductNotice")}
        </div>
      )}

      {upsells.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          {upsells.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Spotlights</span>
              <span className="font-medium text-foreground">€{upsellCost.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border/50 pt-2 text-sm">
            <span className="text-muted-foreground">{t("upsellTotal")}</span>
            <span className="font-semibold text-foreground">€{totalCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("currentBalance")}</span>
            <span className="text-foreground">€{userBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-border/50 pt-2 text-sm">
            <span className="text-muted-foreground">{t("remainingBalance")}</span>
            <span
              className={`font-semibold ${insufficientBalance ? "text-red-500" : "text-foreground"}`}
            >
              €{remainingBalance.toFixed(2)}
            </span>
          </div>
          {insufficientBalance && (
            <div className="mt-1 text-xs text-red-500">{t("insufficientBalance")}</div>
          )}
        </div>
      )}
    </div>
  );
}
