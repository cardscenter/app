"use client";

import { useTranslations } from "next-intl";
import { createClaimsale } from "@/actions/claimsale";
import { useState, useCallback } from "react";
import { CARD_CONDITIONS } from "@/types";
import { Upload, X, ImageIcon, Copy } from "lucide-react";
import { ShippingMethodSelector } from "@/components/ui/shipping-method-selector";
import { CardSearchSelect, type CardSearchSelectValue } from "@/components/ui/card-search-select";
import type { SellerShippingMethod } from "@prisma/client";

type CardItem = {
  id: string;
  cardName: string;
  cardNumber: string;
  sellerNote: string;
  condition: string;
  price: string;
  frontImage: string | null;
  backImage: string | null;
  tcgdex: CardSearchSelectValue | null;
};

function SingleImageUpload({
  image,
  onChange,
  label,
}: {
  image: string | null;
  onChange: (url: string | null) => void;
  label: string;
}) {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.urls?.[0]) onChange(data.urls[0]);
    } catch { /* ignore */ } finally {
      setUploading(false);
    }
  }, [onChange]);

  if (image) {
    return (
      <div className="relative group w-full aspect-square rounded-lg overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={label} className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="size-3.5" />
        </button>
        <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium uppercase text-white">
          {label}
        </div>
      </div>
    );
  }

  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center w-full aspect-square rounded-lg border-2 border-dashed transition-all ${
        uploading ? "opacity-50 pointer-events-none" : "border-border hover:border-primary/50 hover:bg-muted/30"
      }`}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <Upload className="size-5 text-muted-foreground/50" />
      <span className="mt-1 text-[10px] font-medium text-muted-foreground/60">
        {uploading ? "..." : label}
      </span>
    </label>
  );
}

function DuplicateButton({ onDuplicate, remaining }: { onDuplicate: (count: number) => void; remaining: number }) {
  const t = useTranslations("claimsale");
  const [showInput, setShowInput] = useState(false);
  const [count, setCount] = useState("1");

  if (remaining <= 0) return null;

  if (!showInput) {
    return (
      <button
        type="button"
        onClick={() => setShowInput(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
        className="w-14 glass-input px-2 py-1 text-xs text-foreground text-center"
      />
      <button
        type="button"
        onClick={() => { onDuplicate(parseInt(count) || 1); setShowInput(false); setCount("1"); }}
        className="text-xs font-medium text-primary hover:underline"
      >
        {t("duplicateConfirm")}
      </button>
      <button
        type="button"
        onClick={() => { setShowInput(false); setCount("1"); }}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}

export function ClaimsaleForm({ maxItems, shippingMethods }: { maxItems: number; shippingMethods?: SellerShippingMethod[] }) {
  const t = useTranslations("claimsale");
  const tc = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [selectedShippingMethods, setSelectedShippingMethods] = useState<string[]>([]);
  const [items, setItems] = useState<CardItem[]>([
    { id: "1", cardName: "", cardNumber: "", sellerNote: "", condition: "Near Mint", price: "", frontImage: null, backImage: null, tcgdex: null },
  ]);

  function addItem() {
    if (items.length >= maxItems) return;
    setItems([...items, { id: Date.now().toString(), cardName: "", cardNumber: "", sellerNote: "", condition: "Near Mint", price: "", frontImage: null, backImage: null, tcgdex: null }]);
  }

  function duplicateItem(item: CardItem, count: number = 1) {
    const remaining = maxItems - items.length;
    const toAdd = Math.min(count, remaining);
    if (toAdd <= 0) return;
    const newItems: CardItem[] = [];
    for (let i = 0; i < toAdd; i++) {
      newItems.push({ ...item, id: `${Date.now()}-${i}`, frontImage: null, backImage: null });
    }
    setItems([...items, ...newItems]);
  }

  function removeItem(id: string) {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof CardItem, value: string | null) {
    setItems(items.map((i) => i.id !== id ? i : { ...i, [field]: value }));
  }

  function setItemTcgdex(id: string, tcgdex: CardSearchSelectValue | null) {
    setItems((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      // When picking a card, auto-fill name + number if empty so seller doesn't
      // re-type. If they cleared the picker, leave manual fields intact.
      if (tcgdex) {
        return {
          ...i,
          tcgdex,
          cardName: i.cardName || tcgdex.name,
          cardNumber: i.cardNumber || tcgdex.localId,
        };
      }
      return { ...i, tcgdex: null };
    }));
  }

  async function uploadCover(file: File) {
    setCoverUploading(true);
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.urls?.[0]) setCoverImage(data.urls[0]);
    } catch { /* ignore */ } finally {
      setCoverUploading(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const validItems = items.filter((i) => i.price);
    if (validItems.length === 0) {
      setError("Voeg minimaal één kaart toe met een prijs");
      setLoading(false);
      return;
    }

    formData.set("items", JSON.stringify(validItems.map((i) => {
      const imageUrls: string[] = [];
      if (i.frontImage) imageUrls.push(i.frontImage);
      if (i.backImage) imageUrls.push(i.backImage);
      // If the seller picked a TCGdex card and uploaded no own image, fall back
      // to the official artwork so the listing isn't blank.
      if (imageUrls.length === 0 && i.tcgdex?.imageUrl) imageUrls.push(i.tcgdex.imageUrl);
      return {
        cardName: i.cardName || i.tcgdex?.name || `Kaart ${items.indexOf(i) + 1}`,
        cardNumber: i.cardNumber || i.tcgdex?.localId || undefined,
        sellerNote: i.sellerNote || undefined,
        condition: i.condition,
        price: parseFloat(i.price),
        imageUrls,
        tcgdexId: i.tcgdex?.id || undefined,
      };
    })));

    if (coverImage) {
      formData.set("coverImage", coverImage);
    }

    // Include selected shipping methods
    if (selectedShippingMethods.length > 0) {
      formData.set("shippingMethodIds", JSON.stringify(selectedShippingMethods));
    }

    const result = await createClaimsale(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {error && (
        <div className="glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Cover image + basic info */}
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Thumbnail upload */}
        <div className="shrink-0 w-full sm:w-48">
          <label className="block text-sm font-medium text-foreground mb-2">Thumbnail</label>
          {coverImage ? (
            <div className="relative group aspect-square rounded-xl overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImage} alt="Cover" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setCoverImage(null)}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label
              className={`flex cursor-pointer flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed transition-all ${
                coverUploading ? "opacity-50 pointer-events-none" : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])}
              />
              <ImageIcon className="size-10 text-muted-foreground/50" />
              <span className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {coverUploading ? "..." : "Thumbnail"}
              </span>
            </label>
          )}
        </div>

        {/* Title, description, shipping */}
        <div className="flex-1 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-foreground">{t("title")}</label>
            <input id="title" name="title" type="text" required className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground" />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-foreground">{t("description")}</label>
            <textarea id="description" name="description" rows={3} className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground" />
          </div>
          {/* Shipping methods selector */}
          {shippingMethods && shippingMethods.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t("shippingMethods")}</label>
              <ShippingMethodSelector
                methods={shippingMethods}
                selected={selectedShippingMethods}
                onChange={setSelectedShippingMethods}
                context="claimsale"
              />
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">
            Kaarten ({items.length}/{maxItems})
          </h3>
          <button type="button" onClick={addItem} disabled={items.length >= maxItems} className="text-sm font-medium text-primary hover:underline disabled:opacity-50">
            + {t("addCard")}
          </button>
        </div>

        {items.map((item, idx) => (
          <div key={item.id} className="glass-subtle rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
              <div className="flex items-center gap-3">
                <DuplicateButton
                  onDuplicate={(count) => duplicateItem(item, count)}
                  remaining={maxItems - items.length}
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(item.id)} className="text-xs text-red-500 hover:underline">
                    {t("removeCard")}
                  </button>
                )}
              </div>
            </div>

            {/* TCGdex card picker — auto-fills name + number, attaches stable id */}
            <div className="mb-4">
              <CardSearchSelect
                value={item.tcgdex}
                onChange={(v) => setItemTcgdex(item.id, v)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {/* Front & back image uploads */}
              <div className="flex gap-3 shrink-0">
                <div className="w-20 sm:w-24">
                  <SingleImageUpload
                    image={item.frontImage}
                    onChange={(url) => updateItem(item.id, "frontImage", url)}
                    label="Voorkant"
                  />
                </div>
                <div className="w-20 sm:w-24">
                  <SingleImageUpload
                    image={item.backImage}
                    onChange={(url) => updateItem(item.id, "backImage", url)}
                    label="Achterkant"
                  />
                </div>
              </div>

              {/* Card fields */}
              <div className="flex-1 grid grid-cols-2 gap-3 content-start">
                <input
                  type="text"
                  placeholder={`${t("cardName")} (optioneel)`}
                  value={item.cardName}
                  onChange={(e) => updateItem(item.id, "cardName", e.target.value)}
                  className="col-span-2 sm:col-span-1 glass-input px-3 py-2.5 text-sm text-foreground"
                />
                <input
                  type="text"
                  placeholder={t("cardNumber")}
                  value={item.cardNumber}
                  onChange={(e) => updateItem(item.id, "cardNumber", e.target.value)}
                  className="col-span-2 sm:col-span-1 glass-input px-3 py-2.5 text-sm text-foreground"
                />
                <select
                  value={item.condition}
                  onChange={(e) => updateItem(item.id, "condition", e.target.value)}
                  className="glass-input px-3 py-2.5 text-sm text-foreground"
                >
                  {CARD_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={t("price")}
                    value={item.price}
                    onChange={(e) => updateItem(item.id, "price", e.target.value)}
                    className="w-full glass-input px-3 py-2.5 text-sm text-foreground"
                  />
                </div>
                <input
                  type="text"
                  placeholder={t("sellerNote")}
                  value={item.sellerNote}
                  onChange={(e) => updateItem(item.id, "sellerNote", e.target.value)}
                  className="col-span-2 glass-input px-3 py-2.5 text-sm text-foreground"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-subtle rounded-2xl bg-yellow-50/50 p-4 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
        {t("publishWarning")}
      </div>

      <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50">
        {loading ? "..." : tc("save")}
      </button>
    </form>
  );
}
