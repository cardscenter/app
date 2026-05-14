"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Star, TrendingUp, LayoutGrid, Gift, X, Tag, Pencil } from "lucide-react";
import {
  CLAIMSALE_UPSELL_PRICING,
  CLAIMSALE_UPSELL_TYPES_OFFERED,
  applyFreeUpsellsToCost,
  type ClaimsaleUpsellType,
} from "@/lib/upsell-config";
import { getUpsellDiscount } from "@/lib/subscription-tiers";
import {
  availableClaimsaleLabelsFor,
  calculateClaimsaleLabelCost,
  COLOR_CLASSES,
  COLOR_HEX,
  LABEL_COLORS,
  CLAIMSALE_LABEL_TYPES,
  CLAIMSALE_LABELS_CTR_MULTIPLIER,
  MAX_LABELS_PER_CLAIMSALE,
  type LabelColor,
  type ClaimsaleLabelType,
} from "@/lib/claimsale/labels";
import { CLAIMSALE_LABEL_TEXT_NL } from "../claimsale-labels";
import type { ClaimsaleUpsellEntry, ClaimsaleSelectedLabel, ClaimsaleType } from "../wizard-types";

const UPSELL_ICONS: Record<ClaimsaleUpsellType, typeof Star> = {
  HOMEPAGE_SPOTLIGHT: Star,
  CATEGORY_HIGHLIGHT: TrendingUp,
  ITEM_PREVIEW: LayoutGrid,
};

const UPSELL_LABELS: Record<ClaimsaleUpsellType, { label: string; desc: string }> = {
  HOMEPAGE_SPOTLIGHT: {
    label: "Homepage Spotlight",
    desc: "Je claimsale verschijnt in de uitgelichte rij op de homepage.",
  },
  CATEGORY_HIGHLIGHT: {
    label: "Categorie-uitlichting",
    desc: "Je claimsale staat in de 'Gesponsord'-rij op de claimsales-pagina.",
  },
  ITEM_PREVIEW: {
    label: "Geavanceerde Kaart-Preview-Rij",
    desc: "Toon 2 rijen kaart-thumbnails (tot 50 kaarten) als carousel onder je claimsale in de lijst.",
  },
};

const UPSELL_CTR: Record<ClaimsaleUpsellType, number> = {
  HOMEPAGE_SPOTLIGHT: 15,
  CATEGORY_HIGHLIGHT: 8,
  ITEM_PREVIEW: 4,
};

interface StepPromotieProps {
  upsells: ClaimsaleUpsellEntry[];
  labels: ClaimsaleSelectedLabel[];
  userBalance: number;
  accountType: string;
  freeUpsellsRemaining: number;
  claimsaleType: ClaimsaleType;
  hasMintItem: boolean;
  onUpsellsChange: (upsells: ClaimsaleUpsellEntry[]) => void;
  onLabelsChange: (labels: ClaimsaleSelectedLabel[]) => void;
}

export function StepPromotie({
  upsells,
  labels,
  userBalance,
  accountType,
  freeUpsellsRemaining,
  claimsaleType,
  hasMintItem,
  onUpsellsChange,
  onLabelsChange,
}: StepPromotieProps) {
  const t = useTranslations("claimsale");
  const discount = getUpsellDiscount(accountType);

  const toggleUpsell = (type: ClaimsaleUpsellType) => {
    const existing = upsells.find((u) => u.type === type);
    if (existing) {
      onUpsellsChange(upsells.filter((u) => u.type !== type));
    } else {
      onUpsellsChange([...upsells, { type }]);
    }
  };

  const allocation = applyFreeUpsellsToCost(
    upsells.map((u) => ({ type: u.type })),
    accountType,
    freeUpsellsRemaining,
    "claimsale"
  );
  const upsellCost = allocation.total;
  const labelCost = calculateClaimsaleLabelCost(labels.length);
  const totalCost = upsellCost + labelCost;
  const remainingBalance = userBalance - totalCost;
  const insufficientBalance = remainingBalance < 0;
  const freeQuotaLeft = freeUpsellsRemaining - allocation.freeUsed;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-foreground">{t("stepPromotie")}</h2>
      <p className="text-sm text-muted-foreground">{t("promotieIntro")}</p>

      <div className="space-y-3">
        {CLAIMSALE_UPSELL_TYPES_OFFERED.map((type) => {
          const Icon = UPSELL_ICONS[type];
          const meta = UPSELL_LABELS[type];
          const flatPrice = CLAIMSALE_UPSELL_PRICING[type].flatPrice * (1 - discount);
          const idx = upsells.findIndex((u) => u.type === type);
          const active = idx >= 0;
          const entryCost = idx >= 0 ? allocation.perEntry[idx] : 0;
          const isFree = active && entryCost === 0 && type === "HOMEPAGE_SPOTLIGHT";

          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleUpsell(type)}
              className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                active ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className={`rounded-lg p-2 ${active ? "bg-primary/10" : "bg-muted"}`}>
                <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{meta.label}</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    tot {UPSELL_CTR[type]}× meer klikken
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{meta.desc}</div>
                <div className="mt-2">
                  {isFree ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Gift className="h-3.5 w-3.5" />
                      Gratis (gratis quota)
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      &euro;{flatPrice.toFixed(2)} (eenmalig)
                    </span>
                  )}
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    geldt de hele claimsale (max 14 dagen)
                  </span>
                </div>
              </div>
              <input type="checkbox" checked={active} readOnly className="mt-1 h-4 w-4 accent-primary" />
            </button>
          );
        })}

        <LabelsBlock
          labels={labels}
          claimsaleType={claimsaleType}
          hasMintItem={hasMintItem}
          onChange={onLabelsChange}
        />
      </div>

      {freeUpsellsRemaining > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          <span className="inline-flex items-center gap-1.5">
            <Gift className="h-4 w-4" />
            Je hebt nog {freeQuotaLeft} van {freeUpsellsRemaining} gratis Homepage-spotlight
            {freeUpsellsRemaining === 1 ? "" : "s"} deze maand.
          </span>
        </div>
      )}

      {(upsells.length > 0 || labels.length > 0) && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          {upsells.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Promotie</span>
              <span className="font-medium text-foreground">&euro;{upsellCost.toFixed(2)}</span>
            </div>
          )}
          {labels.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Labels ({labels.length})</span>
              <span className="font-medium text-foreground">&euro;{labelCost.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border/50 pt-2 text-sm">
            <span className="text-muted-foreground">Totaal</span>
            <span className="font-semibold text-foreground">&euro;{totalCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Beschikbaar saldo</span>
            <span className="text-foreground">&euro;{userBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-border/50 pt-2 text-sm">
            <span className="text-muted-foreground">Resterend saldo</span>
            <span className={`font-semibold ${insufficientBalance ? "text-red-500" : "text-foreground"}`}>
              &euro;{remainingBalance.toFixed(2)}
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

// ── Labels-blok ────────────────────────────────────────────────────────────
function LabelsBlock({
  labels,
  claimsaleType,
  hasMintItem,
  onChange,
}: {
  labels: ClaimsaleSelectedLabel[];
  claimsaleType: ClaimsaleType;
  hasMintItem: boolean;
  onChange: (labels: ClaimsaleSelectedLabel[]) => void;
}) {
  const [colorPickerFor, setColorPickerFor] = useState<ClaimsaleLabelType | null>(null);
  const availability = availableClaimsaleLabelsFor({ claimsaleType, hasMintItem });
  const availMap = new Map(availability.map((a) => [a.type, a]));
  const isFull = labels.length >= MAX_LABELS_PER_CLAIMSALE;
  const cost = calculateClaimsaleLabelCost(labels.length);

  useEffect(() => {
    const validTypes = new Set(availability.filter((a) => a.available).map((a) => a.type));
    if (labels.some((l) => !validTypes.has(l.type))) {
      onChange(labels.filter((l) => validTypes.has(l.type)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimsaleType, hasMintItem, labels]);

  const toggle = (type: ClaimsaleLabelType) => {
    const existing = labels.find((l) => l.type === type);
    if (existing) {
      onChange(labels.filter((l) => l.type !== type));
      if (colorPickerFor === type) setColorPickerFor(null);
      return;
    }
    if (isFull) return;
    const usedColors = new Set(labels.map((l) => l.colorKey));
    const defaultColor = LABEL_COLORS.find((c) => !usedColors.has(c)) ?? LABEL_COLORS[0];
    onChange([...labels, { type, colorKey: defaultColor }]);
    setColorPickerFor(type);
  };

  const setColor = (type: ClaimsaleLabelType, colorKey: LabelColor) => {
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">Labels</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              tot {CLAIMSALE_LABELS_CTR_MULTIPLIER}× meer klikken
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Max 2 labels · €0,99 voor 1, €1,69 voor 2 — eenmalig per claimsale · kleur inbegrepen
          </div>
        </div>
        <div className="text-right">
          <div className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {labels.length}/{MAX_LABELS_PER_CLAIMSALE}
          </div>
          <div className="mt-1 text-sm font-semibold text-primary">&euro;{cost.toFixed(2)}</div>
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
                {CLAIMSALE_LABEL_TEXT_NL[l.type]}
              </span>
              <button
                type="button"
                onClick={() => setColorPickerFor(colorPickerFor === l.type ? null : l.type)}
                className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Kleur wijzigen"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => toggle(l.type)}
                className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Verwijderen"
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
            Kies kleur voor {CLAIMSALE_LABEL_TEXT_NL[colorPickerFor]}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LABEL_COLORS.map((c) => {
              const sel = labels.find((l) => l.type === colorPickerFor)?.colorKey === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(colorPickerFor, c)}
                  className={`size-7 rounded-full border-2 transition-all ${
                    sel ? "border-foreground ring-2 ring-foreground/20" : "border-card hover:scale-110"
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
        {CLAIMSALE_LABEL_TYPES.map((type) => {
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
              <span className="truncate font-medium">{CLAIMSALE_LABEL_TEXT_NL[type]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        <p>Genoemde klik-multipliers zijn indicaties op basis van branchegemiddelden.</p>
        <p className="font-medium text-foreground">Prijs: {priceLine}</p>
      </div>
    </div>
  );
}
