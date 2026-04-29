"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { CARD_CONDITIONS, SEALED_PRODUCT_TYPES } from "@/types";
import type { ListingType, CardItemEntry } from "@/types";
import type { Series, CardSet } from "@prisma/client";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CardSearchSelect, type CardSearchSelectValue } from "@/components/ui/card-search-select";

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
  // MULTI_CARD
  cardItems: CardItemEntry[];
  // COLLECTION
  estimatedCardCount: number | null;
  // SEALED_PRODUCT
  productType: string;
  // OTHER
  itemCategory: string;
  onChange: (field: string, value: unknown) => void;
}

export function StepDetails({
  listingType,
  seriesList,
  title,
  description,
  cardName,
  condition,
  tcgdex,
  variant,
  cardItems,
  estimatedCardCount,
  productType,
  itemCategory,
  onChange,
}: StepDetailsProps) {
  const t = useTranslations("listing");
  const ttcg = useTranslations("tcg");
  const hasReverse = tcgdex?.variants?.includes("reverse") ?? false;

  const addCardItem = () => {
    onChange("cardItems", [...cardItems, { cardName: "", cardSetId: "", condition: "Near Mint", quantity: 1 }]);
  };

  const removeCardItem = (index: number) => {
    onChange("cardItems", cardItems.filter((_, i) => i !== index));
  };

  const updateCardItem = (index: number, field: keyof CardItemEntry, value: string | number) => {
    const updated = cardItems.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange("cardItems", updated);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-foreground">{t("stepDetails")}</h2>

      {/* Common: Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-foreground">{t("title")}</label>
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
        <label className="block text-sm font-medium text-foreground">{t("description")}</label>
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

      {/* MULTI_CARD specific */}
      {listingType === "MULTI_CARD" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-foreground">{t("cardName")}en</label>
            <button
              type="button"
              onClick={addCardItem}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-3.5 w-3.5" /> {t("addCard")}
            </button>
          </div>
          {cardItems.map((item, index) => (
            <div key={index} className="glass-subtle rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeCardItem(index)}
                  className="text-red-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder={t("cardName")}
                  value={item.cardName}
                  onChange={(e) => updateCardItem(index, "cardName", e.target.value)}
                  className="glass-input px-3 py-2 text-sm text-foreground"
                />
                <select
                  value={item.condition}
                  onChange={(e) => updateCardItem(index, "condition", e.target.value)}
                  className="glass-input px-3 py-2 text-sm text-foreground"
                >
                  {CARD_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">{t("quantity")}</label>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateCardItem(index, "quantity", parseInt(e.target.value) || 1)}
                    className="w-20 glass-input px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>
            </div>
          ))}
          {cardItems.length === 0 && (
            <div className="glass-subtle rounded-xl p-6 text-center text-sm text-muted-foreground">
              {t("addCard")}
            </div>
          )}
        </div>
      )}

      {/* COLLECTION specific */}
      {listingType === "COLLECTION" && (
        <div>
          <label htmlFor="estimatedCardCount" className="block text-sm font-medium text-foreground">{t("estimatedCardCount")}</label>
          <input
            id="estimatedCardCount"
            type="number"
            min={1}
            value={estimatedCardCount ?? ""}
            onChange={(e) => onChange("estimatedCardCount", e.target.value ? parseInt(e.target.value) : null)}
            className="mt-1 block w-48 glass-input px-3 py-2.5 text-foreground"
          />
        </div>
      )}

      {/* SEALED_PRODUCT specific */}
      {listingType === "SEALED_PRODUCT" && (
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
      )}

      {/* OTHER has no extra fields — title + description are sufficient */}
    </div>
  );
}
