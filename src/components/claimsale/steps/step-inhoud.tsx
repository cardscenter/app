"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { CARD_CONDITIONS, ITEM_CONDITIONS } from "@/types";
import { CardSearchSelect, type CardSearchSelectValue } from "@/components/ui/card-search-select";
import { ImageUploader } from "@/components/ui/image-uploader";
import { SingleImageUpload } from "../single-image-upload";
import {
  type ClaimsaleType,
  type ClaimsaleItemDraft,
  makeEmptyCardItem,
  makeEmptyProductItem,
} from "../wizard-types";

const SELLER_NOTE_MAX = 30;

interface StepInhoudProps {
  type: ClaimsaleType;
  items: ClaimsaleItemDraft[];
  maxItems: number;
  onItemsChange: (items: ClaimsaleItemDraft[]) => void;
}

function DuplicateButton({
  onDuplicate,
  remaining,
}: {
  onDuplicate: (count: number) => void;
  remaining: number;
}) {
  const t = useTranslations("claimsale");
  const [showInput, setShowInput] = useState(false);
  const [count, setCount] = useState("1");

  if (remaining <= 0) return null;

  if (!showInput) {
    return (
      <button
        type="button"
        onClick={() => setShowInput(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Copy className="h-3 w-3" />
        {t("duplicate")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min="1"
        max={remaining}
        value={count}
        onChange={(e) => setCount(e.target.value)}
        className="w-14 glass-input px-2 py-1 text-center text-xs text-foreground"
      />
      <button
        type="button"
        onClick={() => {
          onDuplicate(parseInt(count) || 1);
          setShowInput(false);
          setCount("1");
        }}
        className="text-xs font-medium text-primary hover:underline"
      >
        {t("duplicateConfirm")}
      </button>
      <button
        type="button"
        onClick={() => {
          setShowInput(false);
          setCount("1");
        }}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}

export function StepInhoud({ type, items, maxItems, onItemsChange }: StepInhoudProps) {
  const t = useTranslations("claimsale");

  const makeEmpty = type === "CARDS" ? makeEmptyCardItem : makeEmptyProductItem;
  const conditions = type === "CARDS" ? CARD_CONDITIONS : ITEM_CONDITIONS;

  // Items worden ge-append zodat #1 altijd #1 blijft (stabiele nummering).
  function addItem() {
    if (items.length >= maxItems) return;
    onItemsChange([...items, makeEmpty()]);
  }

  function duplicateItem(item: ClaimsaleItemDraft, count = 1) {
    const remaining = maxItems - items.length;
    const toAdd = Math.min(count, remaining);
    if (toAdd <= 0) return;
    const copies: ClaimsaleItemDraft[] = [];
    for (let i = 0; i < toAdd; i++) {
      copies.push({
        ...item,
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        frontImage: null,
        backImage: null,
        itemImages: [],
      });
    }
    onItemsChange([...items, ...copies]);
  }

  function removeItem(id: string) {
    if (items.length <= 1) return;
    onItemsChange(items.filter((i) => i.id !== id));
  }

  function updateItem(id: string, patch: Partial<ClaimsaleItemDraft>) {
    onItemsChange(items.map((i) => (i.id !== id ? i : { ...i, ...patch })));
  }

  function setItemTcgdex(id: string, tcgdex: CardSearchSelectValue | null) {
    onItemsChange(
      items.map((i) => {
        if (i.id !== id) return i;
        if (tcgdex) {
          return {
            ...i,
            tcgdex,
            cardName: tcgdex.name,
            cardNumber: tcgdex.localId,
            variant: "normal",
          };
        }
        return { ...i, tcgdex: null, variant: "normal" };
      })
    );
  }

  function marktprijsFor(item: ClaimsaleItemDraft): number | null {
    if (!item.tcgdex) return null;
    if (item.variant === "reverse") return item.tcgdex.pricingReverse?.avg ?? null;
    return item.tcgdex.pricing?.avg ?? null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {type === "CARDS" ? t("stepInhoudCards") : t("stepInhoudItems")} ({items.length}/{maxItems})
        </h2>
        <button
          type="button"
          onClick={addItem}
          disabled={items.length >= maxItems}
          className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
        >
          + {type === "CARDS" ? t("addCard") : t("addItem")}
        </button>
      </div>

      {/* Nieuwste item bovenaan, maar stabiele nummering: #1 = eerst toegevoegd.
          De `items`-array blijft in toevoeg-volgorde; we renderen 'm omgekeerd
          en nummeren op de oorspronkelijke index. */}
      {items
        .map((item, idx) => ({ item, number: idx + 1 }))
        .reverse()
        .map(({ item, number }) => {
        const hasReverse = item.tcgdex?.variants?.includes("reverse") ?? false;
        const marktprijs = marktprijsFor(item);
        return (
          <div key={item.id} className="glass-subtle rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">#{number}</span>
              <div className="flex items-center gap-3">
                <DuplicateButton
                  onDuplicate={(count) => duplicateItem(item, count)}
                  remaining={maxItems - items.length}
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    {t("removeItem")}
                  </button>
                )}
              </div>
            </div>

            {type === "CARDS" ? (
              <CardItemFields
                item={item}
                hasReverse={hasReverse}
                marktprijs={marktprijs}
                onTcgdex={(v) => setItemTcgdex(item.id, v)}
                onPatch={(patch) => updateItem(item.id, patch)}
              />
            ) : (
              <ProductItemFields
                item={item}
                onPatch={(patch) => updateItem(item.id, patch)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── CARDS-item ─────────────────────────────────────────────────────────────
function CardItemFields({
  item,
  hasReverse,
  marktprijs,
  onTcgdex,
  onPatch,
}: {
  item: ClaimsaleItemDraft;
  hasReverse: boolean;
  marktprijs: number | null;
  onTcgdex: (v: CardSearchSelectValue | null) => void;
  onPatch: (patch: Partial<ClaimsaleItemDraft>) => void;
}) {
  const t = useTranslations("claimsale");

  return (
    <>
      <div className="mb-3">
        <CardSearchSelect value={item.tcgdex} onChange={onTcgdex} />
      </div>

      {item.tcgdex && (item.tcgdex.series?.name || item.tcgdex.setName || item.tcgdex.rarity) && (
        <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
          {item.tcgdex.series?.name && (
            <span className="rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground">
              <span className="opacity-60">Serie:</span>{" "}
              <span className="font-medium text-foreground">{item.tcgdex.series.name}</span>
            </span>
          )}
          {item.tcgdex.setName && (
            <span className="rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground">
              <span className="opacity-60">Set:</span>{" "}
              <span className="font-medium text-foreground">{item.tcgdex.setName}</span>
            </span>
          )}
          {item.tcgdex.rarity && (
            <span className="rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground">
              <span className="opacity-60">Zeldzaamheid:</span>{" "}
              <span className="font-medium text-foreground">{item.tcgdex.rarity}</span>
            </span>
          )}
        </div>
      )}

      {hasReverse && (
        <div className="mb-3 inline-flex rounded-lg border border-border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onPatch({ variant: "normal" })}
            className={`rounded-md px-3 py-1 transition-colors ${
              item.variant === "normal"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => onPatch({ variant: "reverse" })}
            className={`rounded-md px-3 py-1 transition-colors ${
              item.variant === "reverse"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Reverse Holo
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex shrink-0 gap-3">
          <div className="w-20 sm:w-24">
            <SingleImageUpload
              image={item.frontImage}
              onChange={(url) => onPatch({ frontImage: url })}
              label={t("front")}
            />
          </div>
          <div className="w-20 sm:w-24">
            <SingleImageUpload
              image={item.backImage}
              onChange={(url) => onPatch({ backImage: url })}
              label={t("backOptional")}
            />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder={`${t("cardName")} (optioneel)`}
              value={item.cardName}
              onChange={(e) => onPatch({ cardName: e.target.value })}
              className="col-span-2 glass-input px-3 py-2.5 text-sm text-foreground sm:col-span-1"
            />
            <input
              type="text"
              placeholder={t("cardNumber")}
              value={item.cardNumber}
              onChange={(e) => onPatch({ cardNumber: e.target.value })}
              className="col-span-2 glass-input px-3 py-2.5 text-sm text-foreground sm:col-span-1"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <select
              value={item.condition}
              onChange={(e) => onPatch({ condition: e.target.value })}
              className="glass-input px-3 py-2.5 text-sm text-foreground sm:flex-1"
            >
              {CARD_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="flex w-full items-center gap-1 glass-input px-3 py-2.5 sm:w-32">
              <span className="text-sm text-muted-foreground">€</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder={t("price")}
                value={item.price}
                onChange={(e) => onPatch({ price: e.target.value })}
                className="w-full bg-transparent text-sm text-foreground outline-none"
              />
            </div>
            {marktprijs !== null && (
              <button
                type="button"
                onClick={() => onPatch({ price: marktprijs.toFixed(2) })}
                title={t("marketPriceClickHint")}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-left transition-colors hover:bg-muted sm:w-40"
              >
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t("marketPrice")}
                </span>
                <span className="text-sm font-semibold text-foreground">€{marktprijs.toFixed(2)}</span>
              </button>
            )}
          </div>
          <SellerNoteInput
            value={item.sellerNote}
            onChange={(v) => onPatch({ sellerNote: v })}
          />
        </div>
      </div>
    </>
  );
}

// ── ITEMS-item ─────────────────────────────────────────────────────────────
function ProductItemFields({
  item,
  onPatch,
}: {
  item: ClaimsaleItemDraft;
  onPatch: (patch: Partial<ClaimsaleItemDraft>) => void;
}) {
  const t = useTranslations("claimsale");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="text"
          placeholder={t("itemNameLabel")}
          value={item.itemName}
          onChange={(e) => onPatch({ itemName: e.target.value })}
          className="glass-input px-3 py-2.5 text-sm text-foreground"
        />
        <div className="flex items-center gap-3">
          <select
            value={item.condition}
            onChange={(e) => onPatch({ condition: e.target.value })}
            className="glass-input px-3 py-2.5 text-sm text-foreground"
          >
            {ITEM_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex w-32 items-center gap-1 glass-input px-3 py-2.5">
            <span className="text-sm text-muted-foreground">€</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder={t("price")}
              value={item.price}
              onChange={(e) => onPatch({ price: e.target.value })}
              className="w-full bg-transparent text-sm text-foreground outline-none"
            />
          </div>
        </div>
      </div>
      <textarea
        rows={2}
        placeholder={t("itemDescriptionLabel")}
        value={item.itemDescription}
        onChange={(e) => onPatch({ itemDescription: e.target.value })}
        className="block w-full glass-input px-3 py-2.5 text-sm text-foreground"
      />
      <SellerNoteInput value={item.sellerNote} onChange={(v) => onPatch({ sellerNote: v })} />
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t("itemImageRequired")}
        </label>
        <ImageUploader
          images={item.itemImages}
          onChange={(imgs) => onPatch({ itemImages: imgs })}
          maxImages={5}
          context="claimsale"
        />
      </div>
    </div>
  );
}

function SellerNoteInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("claimsale");
  return (
    <div>
      <div className="relative">
        <input
          type="text"
          maxLength={SELLER_NOTE_MAX}
          placeholder={t("sellerNotePlaceholder")}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, SELLER_NOTE_MAX))}
          className="w-full glass-input px-3 py-2.5 pr-12 text-sm text-foreground"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
          {value.length}/{SELLER_NOTE_MAX}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{t("sellerNoteHint")}</p>
    </div>
  );
}
