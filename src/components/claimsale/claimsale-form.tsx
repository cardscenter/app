"use client";

import { useTranslations } from "next-intl";
import { createClaimsale } from "@/actions/claimsale";
import { useState } from "react";
import { CARD_CONDITIONS } from "@/types";
import { ImageUploader } from "@/components/ui/image-uploader";
import type { Series, CardSet } from "@prisma/client";

type SeriesWithSets = Series & { cardSets: CardSet[] };

type CardItem = {
  id: string;
  cardName: string;
  cardSetId: string;
  condition: string;
  price: string;
  seriesId: string;
  imageUrls: string[];
};

export function ClaimsaleForm({ seriesList, maxItems }: { seriesList: SeriesWithSets[]; maxItems: number }) {
  const t = useTranslations("claimsale");
  const ttcg = useTranslations("tcg");
  const tc = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CardItem[]>([
    { id: "1", cardName: "", cardSetId: "", condition: "Near Mint", price: "", seriesId: "", imageUrls: [] },
  ]);

  function addItem() {
    if (items.length >= maxItems) return;
    setItems([...items, { id: Date.now().toString(), cardName: "", cardSetId: "", condition: "Near Mint", price: "", seriesId: "", imageUrls: [] }]);
  }

  function removeItem(id: string) {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof CardItem, value: string) {
    setItems(items.map((i) => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === "seriesId") { updated.cardSetId = ""; }
      return updated;
    }));
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const validItems = items.filter((i) => i.cardName && i.cardSetId && i.price);
    if (validItems.length === 0) {
      setError("Voeg minimaal één kaart toe met naam, set en prijs");
      setLoading(false);
      return;
    }

    formData.set("items", JSON.stringify(validItems.map((i) => ({
      cardName: i.cardName,
      cardSetId: i.cardSetId,
      condition: i.condition,
      price: parseFloat(i.price),
      imageUrls: i.imageUrls,
    }))));

    const result = await createClaimsale(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-foreground">{t("title")}</label>
        <input id="title" name="title" type="text" required className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground" />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-foreground">{t("description")}</label>
        <textarea id="description" name="description" rows={3} className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground" />
      </div>

      <div>
        <label htmlFor="shippingCost" className="block text-sm font-medium text-foreground">{t("shippingCost")}</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">€</span>
          <input id="shippingCost" name="shippingCost" type="number" step="0.01" min="0" required className="block w-32 glass-input px-3 py-2.5 text-foreground" />
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

        {items.map((item, idx) => {
          const ser = seriesList.find((s) => s.id === item.seriesId);
          return (
            <div key={item.id} className="glass-subtle rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(item.id)} className="text-xs text-red-500 hover:underline">
                    {t("removeCard")}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select value={item.seriesId} onChange={(e) => updateItem(item.id, "seriesId", e.target.value)} className="glass-input px-3 py-2.5 text-sm text-foreground">
                  <option value="">{ttcg("selectSeries")}</option>
                  {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={item.cardSetId} onChange={(e) => updateItem(item.id, "cardSetId", e.target.value)} className="glass-input px-3 py-2.5 text-sm text-foreground">
                  <option value="">{ttcg("selectSet")}</option>
                  {ser?.cardSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input type="text" placeholder={t("cardName")} value={item.cardName} onChange={(e) => updateItem(item.id, "cardName", e.target.value)} className="glass-input px-3 py-2.5 text-sm text-foreground" />
                <select value={item.condition} onChange={(e) => updateItem(item.id, "condition", e.target.value)} className="glass-input px-3 py-2.5 text-sm text-foreground">
                  {CARD_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">€</span>
                  <input type="number" step="0.01" min="0.01" placeholder={t("price")} value={item.price} onChange={(e) => updateItem(item.id, "price", e.target.value)} className="w-full glass-input px-3 py-2.5 text-sm text-foreground" />
                </div>
              </div>

              {/* Image upload per card */}
              <div className="mt-3">
                <ImageUploader
                  images={item.imageUrls}
                  onChange={(urls) => setItems(items.map((i) => i.id === item.id ? { ...i, imageUrls: urls } : i))}
                  maxImages={4}
                />
              </div>
            </div>
          );
        })}
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
