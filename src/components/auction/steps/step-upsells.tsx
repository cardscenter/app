"use client";

import { useTranslations } from "next-intl";
import { Star, TrendingUp, Gift } from "lucide-react";
import {
  AUCTION_UPSELL_PRICING,
  AUCTION_UPSELL_TYPES_OFFERED,
  applyFreeUpsellsToCost,
  SPOTLIGHT_CTR_MULTIPLIER,
  CATEGORY_HIGHLIGHT_CTR_MULTIPLIER,
} from "@/lib/upsell-config";
import { getUpsellDiscount } from "@/lib/subscription-tiers";
import type { UpsellType } from "@/types";
import { Slider } from "@/components/ui/slider";

// Window-vorm: 1-indexed kalenderdagen binnen veiling-duur. startDay/endDay
// liggen tussen 1 en `auctionDuration` (inclusief). days = endDay - startDay + 1.
// Volledige veiling = [1, duration]. Alleen laatste dag = [duration, duration].
export interface UpsellWindowEntry {
  type: UpsellType;
  startDay: number;
  endDay: number;
}

interface StepUpsellsProps {
  upsells: UpsellWindowEntry[];
  userBalance: number;
  accountType: string;
  freeUpsellsRemaining: number;
  auctionDuration: number;
  onUpsellsChange: (upsells: UpsellWindowEntry[]) => void;
}

const UPSELL_ICONS: Record<UpsellType, typeof Star> = {
  HOMEPAGE_SPOTLIGHT: Star,
  CATEGORY_HIGHLIGHT: TrendingUp,
  URGENT_LABEL: Star, // niet gebruikt — URGENT_LABEL wordt niet meer aangeboden
};

const UPSELL_KEYS: Record<UpsellType, { label: string; desc: string }> = {
  HOMEPAGE_SPOTLIGHT: { label: "upsellSpotlight", desc: "upsellSpotlightDesc" },
  CATEGORY_HIGHLIGHT: { label: "upsellHighlight", desc: "upsellHighlightDesc" },
  URGENT_LABEL: { label: "upsellUrgent", desc: "upsellUrgentDesc" },
};

export function StepUpsells({
  upsells,
  userBalance,
  accountType,
  freeUpsellsRemaining,
  auctionDuration,
  onUpsellsChange,
}: StepUpsellsProps) {
  const t = useTranslations("auction");
  const discount = getUpsellDiscount(accountType);
  const hasDiscount = discount > 0;

  const toggleUpsell = (type: UpsellType) => {
    const existing = upsells.find((u) => u.type === type);
    if (existing) {
      onUpsellsChange(upsells.filter((u) => u.type !== type));
    } else {
      // Default = volledig venster (dag 1 t/m laatste dag).
      onUpsellsChange([
        ...upsells,
        { type, startDay: 1, endDay: auctionDuration },
      ]);
    }
  };

  const updateWindow = (type: UpsellType, range: [number, number]) => {
    onUpsellsChange(
      upsells.map((u) =>
        u.type === type ? { ...u, startDay: range[0], endDay: range[1] } : u
      )
    );
  };

  // Cost-allocator (zelfde als server) — werkt op `days` per entry, dus we
  // mappen onze window-entries even. Inclusive range: dag 1 t/m dag 1 = 1 dag.
  const allocation = applyFreeUpsellsToCost(
    upsells.map((u) => ({
      type: u.type,
      days: Math.max(0, u.endDay - u.startDay + 1),
    })),
    accountType,
    freeUpsellsRemaining,
    "auction"
  );
  const upsellCost = allocation.total;
  const totalCost = upsellCost;
  const remainingBalance = userBalance - totalCost;
  const insufficientBalance = remainingBalance < 0;
  const freeQuotaLeft = freeUpsellsRemaining - allocation.freeUsed;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-foreground">{t("stepUpsells")}</h2>

      {/* Spotlight-kaarten verticaal gestackt */}
      <div className="space-y-3">
        {AUCTION_UPSELL_TYPES_OFFERED.map((type) => {
          const Icon = UPSELL_ICONS[type];
          const keys = UPSELL_KEYS[type];
          const config = AUCTION_UPSELL_PRICING[type];
          const active = upsells.find((u) => u.type === type);
          const dailyCost = config.dailyCost * (1 - discount);
          const idx = upsells.findIndex((u) => u.type === type);
          const entryCost = idx >= 0 ? allocation.perEntry[idx] : 0;
          const isFree =
            idx >= 0 && entryCost === 0 && type === "HOMEPAGE_SPOTLIGHT";
          const days = active ? Math.max(0, active.endDay - active.startDay + 1) : 0;
          const ctrMultiplier =
            type === "HOMEPAGE_SPOTLIGHT"
              ? SPOTLIGHT_CTR_MULTIPLIER
              : CATEGORY_HIGHLIGHT_CTR_MULTIPLIER;

          return (
            <div
              key={type}
              className={`rounded-2xl border-2 p-4 transition-all ${
                active
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleUpsell(type)}
                className="flex w-full items-start gap-3 text-left"
              >
                <div
                  className={`rounded-lg p-2 ${active ? "bg-primary/10" : "bg-muted"}`}
                >
                  <Icon
                    className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{t(keys.label)}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      tot {ctrMultiplier}× meer klikken
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t(keys.desc)}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-primary">
                    &euro;{dailyCost.toFixed(2)}
                    {t("upsellPerDay")}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!active}
                  readOnly
                  className="mt-1 h-4 w-4 accent-primary"
                />
              </button>

              {/* Dual-handle window-slider */}
              {active && (() => {
                const surfaceLabel =
                  type === "HOMEPAGE_SPOTLIGHT" ? "homepage" : "categorie";
                const isLastDayOnly =
                  active.startDay === auctionDuration &&
                  active.endDay === auctionDuration;
                const isFullWindow =
                  active.startDay === 1 && active.endDay === auctionDuration;
                return (
                <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {isLastDayOnly ? (
                        <>
                          Op {surfaceLabel} zichtbaar op de{" "}
                          <span className="font-semibold text-foreground">
                            laatste dag
                          </span>
                        </>
                      ) : isFullWindow ? (
                        <>
                          Op {surfaceLabel} zichtbaar de{" "}
                          <span className="font-semibold text-foreground">
                            hele veiling
                          </span>
                          {" "}({days} dagen)
                        </>
                      ) : (
                        <>
                          Op {surfaceLabel} zichtbaar van dag{" "}
                          <span className="font-semibold text-foreground">
                            {active.startDay}
                          </span>
                          {" "}t/m dag{" "}
                          <span className="font-semibold text-foreground">
                            {active.endDay}
                          </span>
                          {" "}({days} {days === 1 ? "dag" : "dagen"})
                        </>
                      )}
                    </span>
                    {isFree ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Gift className="h-3 w-3" />
                        Gratis
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">
                        &euro;{entryCost.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <Slider
                    value={[active.startDay, active.endDay]}
                    min={1}
                    max={auctionDuration}
                    step={1}
                    onValueChange={(v) => {
                      if (Array.isArray(v) && v.length === 2) {
                        updateWindow(type, [v[0], v[1]]);
                      }
                    }}
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Veiling-start</span>
                    <span>Veiling-eind</span>
                  </div>
                </div>
                );
              })()}
            </div>
          );
        })}

      </div>

      {/* Free-quota notice */}
      {freeUpsellsRemaining > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          <span className="inline-flex items-center gap-1.5">
            <Gift className="h-4 w-4" />
            Je hebt nog {freeQuotaLeft} van {freeUpsellsRemaining} gratis
            Homepage-spotlight{freeUpsellsRemaining === 1 ? "" : "s"} deze maand.
          </span>
        </div>
      )}

      {/* Premium discount notice */}
      {hasDiscount && (
        <div className="rounded-xl border border-border bg-card p-3 text-sm text-primary">
          {t("premiumDiscount")}
        </div>
      )}

      {/* Cost summary */}
      {upsells.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          {upsells.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Spotlights</span>
              <span className="font-medium text-foreground">
                &euro;{upsellCost.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-border/50 pt-2 text-sm">
            <span className="text-muted-foreground">{t("upsellTotal")}</span>
            <span className="font-semibold text-foreground">
              &euro;{totalCost.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("currentBalance")}</span>
            <span className="text-foreground">
              &euro;{userBalance.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-t border-border/50 pt-2 text-sm">
            <span className="text-muted-foreground">{t("remainingBalance")}</span>
            <span
              className={`font-semibold ${insufficientBalance ? "text-red-500" : "text-foreground"}`}
            >
              &euro;{remainingBalance.toFixed(2)}
            </span>
          </div>
          {insufficientBalance && (
            <div className="mt-1 text-xs text-red-500">
              {t("insufficientBalance")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
