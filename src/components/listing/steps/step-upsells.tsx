"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Star, TrendingUp, Gift, X, Tag, Pencil } from "lucide-react";
import {
  UPSELL_PRICING,
  LISTING_UPSELL_TYPES_OFFERED,
  applyFreeUpsellsToCost,
} from "@/lib/upsell-config";
import { getUpsellDiscount } from "@/lib/subscription-tiers";
import type { UpsellType } from "@/types";
import {
  availableLabelsFor,
  calculateLabelCost,
  COLOR_CLASSES,
  COLOR_HEX,
  LABEL_COLORS,
  LABEL_TEXT_NL,
  LABEL_TYPES,
  LABELS_CTR_MULTIPLIER,
  SPOTLIGHT_CTR_MULTIPLIER,
  CATEGORY_HIGHLIGHT_CTR_MULTIPLIER,
  MAX_LABELS_PER_LISTING,
  type LabelColor,
  type LabelType,
} from "@/lib/listing/labels";

interface UpsellEntry {
  type: UpsellType;
  days: number;
}

export interface SelectedLabel {
  type: LabelType;
  colorKey: LabelColor;
}

interface StepUpsellsProps {
  upsells: UpsellEntry[];
  labels: SelectedLabel[];
  userBalance: number;
  accountType: string;
  freeUpsellsRemaining: number;
  listingType: string;
  condition: string | null;
  onUpsellsChange: (upsells: UpsellEntry[]) => void;
  onLabelsChange: (labels: SelectedLabel[]) => void;
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
  labels,
  userBalance,
  accountType,
  freeUpsellsRemaining,
  listingType,
  condition,
  onUpsellsChange,
  onLabelsChange,
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
  const labelCost = calculateLabelCost(labels.length);
  const totalCost = upsellCost + labelCost;
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
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
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

        <LabelsBlock
          labels={labels}
          listingType={listingType}
          condition={condition}
          onChange={onLabelsChange}
        />
      </div>

      {freeUpsellsRemaining > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
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

      {(upsells.length > 0 || labels.length > 0) && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          {upsells.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Spotlights</span>
              <span className="font-medium text-foreground">€{upsellCost.toFixed(2)}</span>
            </div>
          )}
          {labels.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Labels ({labels.length})</span>
              <span className="font-medium text-foreground">€{labelCost.toFixed(2)}</span>
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

// ---------------------------------------------------------------------------
// LabelsBlock — spiegel van auction-versie. 7 label-types voor listings
// (geen GEEN_RESERVE/DIRECT_KOPEN — die zijn auction-jargon).
// ---------------------------------------------------------------------------

function LabelsBlock({
  labels,
  listingType,
  condition,
  onChange,
}: {
  labels: SelectedLabel[];
  listingType: string;
  condition: string | null;
  onChange: (labels: SelectedLabel[]) => void;
}) {
  const t = useTranslations("listing");
  const [colorPickerFor, setColorPickerFor] = useState<LabelType | null>(null);
  const availability = availableLabelsFor({ condition, listingType });
  const availMap = new Map(availability.map((a) => [a.type, a]));
  const isFull = labels.length >= MAX_LABELS_PER_LISTING;
  const cost = calculateLabelCost(labels.length);

  useEffect(() => {
    const validTypes = new Set(
      availability.filter((a) => a.available).map((a) => a.type),
    );
    if (labels.some((l) => !validTypes.has(l.type))) {
      onChange(labels.filter((l) => validTypes.has(l.type)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition, listingType, labels]);

  const toggle = (type: LabelType) => {
    const existing = labels.find((l) => l.type === type);
    if (existing) {
      onChange(labels.filter((l) => l.type !== type));
      if (colorPickerFor === type) setColorPickerFor(null);
      return;
    }
    if (isFull) return;
    const usedColors = new Set(labels.map((l) => l.colorKey));
    const defaultColor =
      LABEL_COLORS.find((c) => !usedColors.has(c)) ?? LABEL_COLORS[0];
    onChange([...labels, { type, colorKey: defaultColor }]);
    setColorPickerFor(type);
  };

  const setColor = (type: LabelType, colorKey: LabelColor) => {
    onChange(labels.map((l) => (l.type === type ? { ...l, colorKey } : l)));
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
            <span className="font-medium text-foreground">{t("labelsTitle")}</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              {t("labelCtrUplift", { n: LABELS_CTR_MULTIPLIER })}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{t("labelsDescription")}</div>
        </div>
        <div className="text-right">
          <div className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {labels.length}/{MAX_LABELS_PER_LISTING}
          </div>
          <div className="mt-1 text-sm font-semibold text-primary">€{cost.toFixed(2)}</div>
        </div>
      </div>

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

      {colorPickerFor && labels.find((l) => l.type === colorPickerFor) && (
        <div className="mt-3 rounded-lg border border-border bg-muted p-2">
          <div className="mb-1.5 text-xs text-muted-foreground">
            {t("labelChooseColor", { name: LABEL_TEXT_NL[colorPickerFor] })}
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
        <p>{t("labelDisclaimer")}</p>
        <p className="font-medium text-foreground">Prijs: {priceLine}</p>
      </div>
    </div>
  );
}
