"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Star, TrendingUp, Gift, X, Tag, Pencil } from "lucide-react";
import {
  AUCTION_UPSELL_PRICING,
  AUCTION_UPSELL_TYPES_OFFERED,
  applyFreeUpsellsToCost,
} from "@/lib/upsell-config";
import { getUpsellDiscount } from "@/lib/subscription-tiers";
import type { UpsellType } from "@/types";
import { Slider } from "@/components/ui/slider";
import {
  availableLabelsFor,
  calculateLabelCost,
  COLOR_CLASSES,
  COLOR_HEX,
  LABEL_COLORS,
  LABEL_TYPES,
  LABELS_CTR_MULTIPLIER,
  SPOTLIGHT_CTR_MULTIPLIER,
  CATEGORY_HIGHLIGHT_CTR_MULTIPLIER,
  MAX_LABELS_PER_AUCTION,
  type LabelColor,
  type LabelType,
} from "@/lib/auction/labels";

// Window-vorm: 1-indexed kalenderdagen binnen veiling-duur. startDay/endDay
// liggen tussen 1 en `auctionDuration` (inclusief). days = endDay - startDay + 1.
// Volledige veiling = [1, duration]. Alleen laatste dag = [duration, duration].
export interface UpsellWindowEntry {
  type: UpsellType;
  startDay: number;
  endDay: number;
}

export interface SelectedLabel {
  type: LabelType;
  colorKey: LabelColor;
}

interface StepUpsellsProps {
  upsells: UpsellWindowEntry[];
  labels: SelectedLabel[];
  userBalance: number;
  accountType: string;
  freeUpsellsRemaining: number;
  auctionDuration: number;
  reservePrice: number | null;
  buyNowPrice: number | null;
  condition: string | null;
  auctionType: string | null;
  onUpsellsChange: (upsells: UpsellWindowEntry[]) => void;
  onLabelsChange: (labels: SelectedLabel[]) => void;
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
  labels,
  userBalance,
  accountType,
  freeUpsellsRemaining,
  auctionDuration,
  reservePrice,
  buyNowPrice,
  condition,
  auctionType,
  onUpsellsChange,
  onLabelsChange,
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
  const labelCost = calculateLabelCost(labels.length);
  const totalCost = upsellCost + labelCost;
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

        {/* Labels-blok */}
        <LabelsBlock
          labels={labels}
          reservePrice={reservePrice}
          buyNowPrice={buyNowPrice}
          condition={condition}
          auctionType={auctionType}
          onChange={onLabelsChange}
        />
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
      {(upsells.length > 0 || labels.length > 0) && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          {upsells.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Spotlights</span>
              <span className="font-medium text-foreground">
                &euro;{upsellCost.toFixed(2)}
              </span>
            </div>
          )}
          {labels.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Labels ({labels.length})
              </span>
              <span className="font-medium text-foreground">
                &euro;{labelCost.toFixed(2)}
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

// ---------------------------------------------------------------------------
// Labels-blok — multi-select met conditional availability + kleur-popover.
// ---------------------------------------------------------------------------

const LABEL_TEXT_NL: Record<LabelType, string> = {
  GEEN_RESERVE: "Geen Reserve",
  DIRECT_KOPEN: "Direct Kopen",
  MOET_NU_WEG: "Moet nu weg!",
  HOT_ITEM: "Hot Item",
  TOPSTAAT: "Topstaat",
  ZELDZAAM: "Zeldzaam",
  HOLO_FOIL: "Holo / Foil",
  SNEL_VERZONDEN: "Snel verzonden",
  COMPLETE_SET: "Complete set",
};

function LabelsBlock({
  labels,
  reservePrice,
  buyNowPrice,
  condition,
  auctionType,
  onChange,
}: {
  labels: SelectedLabel[];
  reservePrice: number | null;
  buyNowPrice: number | null;
  condition: string | null;
  auctionType: string | null;
  onChange: (labels: SelectedLabel[]) => void;
}) {
  const [colorPickerFor, setColorPickerFor] = useState<LabelType | null>(null);
  const availability = availableLabelsFor({
    reservePrice,
    buyNowPrice,
    condition,
    auctionType,
  });
  const availMap = new Map(availability.map((a) => [a.type, a]));
  const isFull = labels.length >= MAX_LABELS_PER_AUCTION;
  const cost = calculateLabelCost(labels.length);

  // Stale-state-fix: als seller eerst "Geen Reserve" selecteert en daarna een
  // reserve toevoegt, moet het label automatisch wegvallen — anders blijft het
  // tot submit-time staan en faalt de server-validatie. Doen we hier client-side
  // zodat de UI direct synchroniseert met de form-state.
  useEffect(() => {
    const validTypes = new Set(
      availability.filter((a) => a.available).map((a) => a.type),
    );
    if (labels.some((l) => !validTypes.has(l.type))) {
      onChange(labels.filter((l) => validTypes.has(l.type)));
    }
    // dependencies: alleen de availability-bepalende velden + labels-array zelf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservePrice, buyNowPrice, condition, auctionType, labels]);

  const toggle = (type: LabelType) => {
    const existing = labels.find((l) => l.type === type);
    if (existing) {
      onChange(labels.filter((l) => l.type !== type));
      if (colorPickerFor === type) setColorPickerFor(null);
      return;
    }
    if (isFull) return;
    // Default-kleur: kies een kleur die nog niet in gebruik is.
    const usedColors = new Set(labels.map((l) => l.colorKey));
    const defaultColor =
      LABEL_COLORS.find((c) => !usedColors.has(c)) ?? LABEL_COLORS[0];
    onChange([...labels, { type, colorKey: defaultColor }]);
    setColorPickerFor(type);
  };

  const setColor = (type: LabelType, colorKey: LabelColor) => {
    onChange(
      labels.map((l) => (l.type === type ? { ...l, colorKey } : l))
    );
  };

  const priceLine =
    labels.length === 0
      ? "Geen kosten"
      : labels.length === 1
        ? "€0,99 eenmalig"
        : "€1,69 eenmalig (€0,29 korting op 2e label)";

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2">
          <Tag className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">Labels</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              tot {LABELS_CTR_MULTIPLIER}× meer klikken
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Max 2 labels · €0,99 voor 1, €1,69 voor 2 — eenmalig per veiling · kleur inbegrepen
          </div>
        </div>
        <div className="text-right">
          <div className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {labels.length}/{MAX_LABELS_PER_AUCTION}
          </div>
          <div className="mt-1 text-sm font-semibold text-primary">
            &euro;{cost.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Geselecteerde labels — preview met kleur + remove + change-color */}
      {labels.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
          {labels.map((l) => (
            <div
              key={l.type}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-1 pr-1.5"
            >
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${COLOR_CLASSES[l.colorKey]}`}
              >
                {LABEL_TEXT_NL[l.type]}
              </span>
              <button
                type="button"
                onClick={() =>
                  setColorPickerFor(colorPickerFor === l.type ? null : l.type)
                }
                className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Kleur wijzigen"
                aria-label="Kleur wijzigen"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => toggle(l.type)}
                className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Verwijderen"
                aria-label="Verwijderen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Kleur-popover voor het label dat nu actief is */}
      {colorPickerFor && labels.find((l) => l.type === colorPickerFor) && (
        <div className="mt-3 rounded-lg border border-border bg-muted p-2">
          <div className="mb-1.5 text-xs text-muted-foreground">
            Kies kleur voor {LABEL_TEXT_NL[colorPickerFor]}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LABEL_COLORS.map((c) => {
              const sel =
                labels.find((l) => l.type === colorPickerFor)?.colorKey === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(colorPickerFor, c)}
                  className={`size-7 rounded-full border-2 transition-all ${
                    sel
                      ? "border-foreground ring-2 ring-foreground/20"
                      : "border-card hover:scale-110"
                  }`}
                  style={{ backgroundColor: COLOR_HEX[c] }}
                  title={c}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Beschikbare labels — pills (CTR-hint zit op categorie-niveau in de header) */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LABEL_TYPES.map((type) => {
          const avail = availMap.get(type);
          const selected = !!labels.find((l) => l.type === type);
          const isAvailable = avail?.available ?? false;
          const disabled = !isAvailable || (isFull && !selected);

          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => toggle(type)}
              className={`relative flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                selected
                  ? "border-primary bg-primary/10 text-foreground"
                  : disabled
                    ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground opacity-60"
                    : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
              }`}
              title={!isAvailable ? avail?.reason : undefined}
            >
              <span className="truncate font-medium">{LABEL_TEXT_NL[type]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        <p>
          Genoemde klik-multipliers zijn indicaties op basis van
          branchegemiddelden — jouw resultaat kan afwijken.
        </p>
        <p className="font-medium text-foreground">Prijs: {priceLine}</p>
      </div>
    </div>
  );
}
