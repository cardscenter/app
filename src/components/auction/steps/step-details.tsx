"use client";

import { useTranslations } from "next-intl";
import { CARD_CONDITIONS, SEALED_PRODUCT_TYPES } from "@/types";
import type { AuctionType } from "@/types";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CardSearchSelect, type CardSearchSelectValue } from "@/components/ui/card-search-select";

interface StepDetailsProps {
  auctionType: AuctionType;
  title: string;
  description: string;
  cardName: string;
  condition: string;
  tcgdex: CardSearchSelectValue | null;
  variant: "normal" | "reverse";
  estimatedCardCount: number | null;
  conditionRange: string;
  productType: string;
  itemCategory: string;
  onChange: (field: string, value: unknown) => void;
}

export function StepDetails({
  auctionType,
  title,
  description,
  cardName,
  condition,
  tcgdex,
  variant,
  estimatedCardCount,
  conditionRange,
  productType,
  itemCategory,
  onChange,
}: StepDetailsProps) {
  const t = useTranslations("auction");
  const hasReverse = tcgdex?.variants?.includes("reverse") ?? false;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-foreground">{t("stepDetails")}</h2>

      {/* Title */}
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

      {/* Description */}
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
      {auctionType === "SINGLE_CARD" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Zoek kaart</label>
            <CardSearchSelect
              value={tcgdex}
              onChange={(v) => {
                onChange("tcgdex", v);
                // Pick always overwrites name — seller just clicked this exact card.
                if (v) onChange("cardName", v.name);
                // Reset variant so a fresh pick starts on "normal".
                onChange("variant", "normal");
                if (!v) onChange("tcgdex", null);
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
      {auctionType === "MULTI_CARD" && (
        <div>
          <label htmlFor="estimatedCardCount" className="block text-sm font-medium text-foreground">
            {t("estimatedCardCount")}
          </label>
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

      {/* COLLECTION specific */}
      {auctionType === "COLLECTION" && (
        <div className="space-y-4">
          <div>
            <label htmlFor="estimatedCardCountCol" className="block text-sm font-medium text-foreground">
              {t("estimatedCardCount")}
            </label>
            <input
              id="estimatedCardCountCol"
              type="number"
              min={1}
              value={estimatedCardCount ?? ""}
              onChange={(e) => onChange("estimatedCardCount", e.target.value ? parseInt(e.target.value) : null)}
              className="mt-1 block w-48 glass-input px-3 py-2.5 text-foreground"
            />
          </div>
          <div>
            <label htmlFor="conditionRange" className="block text-sm font-medium text-foreground">
              {t("conditionRange")}
            </label>
            <input
              id="conditionRange"
              type="text"
              value={conditionRange}
              onChange={(e) => onChange("conditionRange", e.target.value)}
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
              placeholder="e.g. Light Played - Near Mint"
            />
          </div>
        </div>
      )}

      {/* SEALED_PRODUCT specific */}
      {auctionType === "SEALED_PRODUCT" && (
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

      {/* OTHER specific */}
      {auctionType === "OTHER" && (
        <div>
          <label htmlFor="itemCategory" className="block text-sm font-medium text-foreground">
            {t("itemCategory")}
          </label>
          <input
            id="itemCategory"
            type="text"
            value={itemCategory}
            onChange={(e) => onChange("itemCategory", e.target.value)}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
            placeholder={t("itemCategoryPlaceholder")}
          />
        </div>
      )}
    </div>
  );
}
