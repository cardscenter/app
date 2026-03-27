"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { CARD_CONDITIONS, SEALED_PRODUCT_TYPES } from "@/types";
import type { ListingType, CardItemEntry } from "@/types";
import type { Series, CardSet } from "@prisma/client";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

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
  cardItems,
  estimatedCardCount,
  productType,
  itemCategory,
  onChange,
}: StepDetailsProps) {
  const t = useTranslations("listing");
  const ttcg = useTranslations("tcg");

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
