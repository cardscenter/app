"use client";

import { useTranslations } from "next-intl";
import { CARD_CONDITIONS, SEALED_PRODUCT_TYPES } from "@/types";
import type { ListingType } from "@/types";
import type { Series, CardSet } from "@prisma/client";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CardSearchSelect, type CardSearchSelectValue } from "@/components/ui/card-search-select";
import { Layers } from "lucide-react";

type SeriesWithSets = Series & { cardSets: CardSet[] };

interface StepDetailsProps {
  listingType: ListingType;
  seriesList: SeriesWithSets[];
  title: string;
  description: string;
  // SINGLE_CARD
  cardName: string;
  cardSetId: string;
  selectedSeries: string;
  condition: string;
  tcgdex: CardSearchSelectValue | null;
  variant: "normal" | "reverse";
  // SEALED_PRODUCT
  productType: string;
  // OTHER
  itemCategory: string;
  // SEALED_PRODUCT + OTHER (Fase 27.23)
  stockQuantity: number;
  onChange: (field: string, value: unknown) => void;
}

export function StepDetails({
  listingType,
  title,
  description,
  cardName,
  condition,
  tcgdex,
  variant,
  productType,
  itemCategory,
  stockQuantity,
  onChange,
}: StepDetailsProps) {
  const t = useTranslations("listing");
  const hasReverse = tcgdex?.variants?.includes("reverse") ?? false;

  // Char-counters voor title (100) en description (2000). Description-tekst
  // wordt zonder HTML-tags geteld, want de backend valideert ook op tekst-lengte.
  const titleCharsLeft = 100 - title.length;
  const descTextLength = description.replace(/<[^>]*>/g, "").trim().length;
  const descCharsLeft = 2000 - descTextLength;

  return (
    <div className="space-y-5">
      {/* Common: Title */}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="title" className="block text-sm font-medium text-foreground">{t("title")}</label>
          <span className={`text-xs ${titleCharsLeft < 10 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
            {titleCharsLeft}/100
          </span>
        </div>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => onChange("title", e.target.value)}
          className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          maxLength={100}
        />
      </div>

      {/* Common: Description with rich text */}
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-foreground">{t("description")}</label>
          <span className={`text-xs ${descCharsLeft < 100 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
            {descTextLength}/2000
          </span>
        </div>
        <RichTextEditor
          value={description}
          onChange={(html) => onChange("description", html)}
          rows={4}
          placeholder={t("descriptionPlaceholder")}
        />
      </div>

      {/* SINGLE_CARD specific */}
      {listingType === "SINGLE_CARD" && (
        <div className="space-y-4">
          {/* Database card picker — auto-fills cardName when selected */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Zoek kaart</label>
            <CardSearchSelect
              value={tcgdex}
              onChange={(v) => {
                onChange("tcgdex", v);
                // Pick always overwrites name — seller just clicked this exact card.
                if (v) onChange("cardName", v.name);
                onChange("variant", "normal");
              }}
            />
          </div>

          {/* Extra info chips — read-only metadata from the DB card */}
          {tcgdex && (tcgdex.series?.name || tcgdex.setName || tcgdex.rarity) && (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {tcgdex.series?.name && (
                <span className="rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground">
                  <span className="opacity-60">Serie:</span> <span className="font-medium text-foreground">{tcgdex.series.name}</span>
                </span>
              )}
              {tcgdex.setName && (
                <span className="rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground">
                  <span className="opacity-60">Set:</span> <span className="font-medium text-foreground">{tcgdex.setName}</span>
                </span>
              )}
              {tcgdex.rarity && (
                <span className="rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground">
                  <span className="opacity-60">Zeldzaamheid:</span> <span className="font-medium text-foreground">{tcgdex.rarity}</span>
                </span>
              )}
            </div>
          )}

          {/* Variant selector — shown only when the DB card has a reverse-holo print.
              Drives the Marktwaarde shown in the pricing step. */}
          {hasReverse && (
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => onChange("variant", "normal")}
                className={`rounded-md px-3 py-1 transition-colors ${variant === "normal" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => onChange("variant", "reverse")}
                className={`rounded-md px-3 py-1 transition-colors ${variant === "reverse" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                Reverse Holo
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cardName" className="block text-sm font-medium text-foreground">{t("cardName")}</label>
              <input
                id="cardName"
                type="text"
                value={cardName}
                onChange={(e) => onChange("cardName", e.target.value)}
                className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">{t("condition")}</label>
              <select
                value={condition}
                onChange={(e) => onChange("condition", e.target.value)}
                className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
              >
                {CARD_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* MULTI_CARD: bundel-hint. Geen per-kaart-input meer — als de seller per
          kaart wil verkopen is een claimsale de juiste route. Kaartlijst hoort
          in de beschrijving. */}
      {listingType === "MULTI_CARD" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <Layers className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("multiCardBundleHint")}</p>
        </div>
      )}

      {/* COLLECTION: geen extra velden meer — alle info hoort in de
          beschrijving. */}

      {/* SEALED_PRODUCT specific */}
      {listingType === "SEALED_PRODUCT" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">{t("productType")}</label>
            <select
              value={productType}
              onChange={(e) => onChange("productType", e.target.value)}
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground sm:w-64"
            >
              <option value="">--</option>
              {SEALED_PRODUCT_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {t(`product${pt.charAt(0)}${pt.slice(1).toLowerCase().replace(/_/g, "")}` as never) || pt}
                </option>
              ))}
            </select>
          </div>
          <StockQuantityInput value={stockQuantity} onChange={(n) => onChange("stockQuantity", n)} t={t} />
        </div>
      )}

      {/* OTHER specific (Fase 27.23: stockQuantity beschikbaar) */}
      {listingType === "OTHER" && (
        <StockQuantityInput value={stockQuantity} onChange={(n) => onChange("stockQuantity", n)} t={t} />
      )}
    </div>
  );
}

// Mini-component voor de voorraad-input. Default 1; > 1 betekent dat er
// meerdere stuks van hetzelfde product worden aangeboden voor directe koop
// per stuk (Fase 27.23).
function StockQuantityInput({
  value,
  onChange,
  t,
}: {
  value: number;
  onChange: (n: number) => void;
  t: (key: string) => string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">{t("stockQuantity.label")}</label>
      <input
        type="number"
        min={1}
        max={999}
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value) || 1))}
        className="mt-1 block w-32 glass-input px-3 py-2.5 text-foreground"
      />
      <p className="mt-1 text-xs text-muted-foreground">{t("stockQuantity.hint")}</p>
    </div>
  );
}
