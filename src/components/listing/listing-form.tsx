"use client";

import { useTranslations } from "next-intl";
import { createListing } from "@/actions/listing";
import { useActionState, useState } from "react";
import { CARD_CONDITIONS } from "@/types";
import { ImageUploader } from "@/components/ui/image-uploader";
import type { Series, CardSet } from "@prisma/client";

type SeriesWithSets = Series & { cardSets: CardSet[] };

export function ListingForm({ seriesList }: { seriesList: SeriesWithSets[] }) {
  const t = useTranslations("listing");
  const ttcg = useTranslations("tcg");

  const [selectedSeries, setSelectedSeries] = useState("");
  const [pricingType, setPricingType] = useState("FIXED");
  const [images, setImages] = useState<string[]>([]);

  const series = seriesList.find((s) => s.id === selectedSeries);

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null | undefined, formData: FormData) => {
      const result = await createListing(formData);
      return result ?? null;
    },
    null
  );

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {state.error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-foreground">{t("title")}</label>
        <input id="title" name="title" type="text" required className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground" />
      </div>

      {/* Card details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground">{ttcg("selectSeries")}</label>
          <select value={selectedSeries} onChange={(e) => setSelectedSeries(e.target.value)} className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground">
            <option value="">--</option>
            {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{ttcg("selectSet")}</label>
          <select name="cardSetId" className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground">
            <option value="">--</option>
            {series?.cardSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cardName" className="block text-sm font-medium text-foreground">{t("cardName")}</label>
          <input id="cardName" name="cardName" type="text" required className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t("condition")}</label>
          <select name="condition" className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground">
            {CARD_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Images */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">{t("photos")}</label>
        <input type="hidden" name="imageUrls" value={JSON.stringify(images)} />
        <ImageUploader images={images} onChange={setImages} maxImages={10} />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-foreground">{t("description")}</label>
        <textarea id="description" name="description" rows={4} required className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground" />
      </div>

      {/* Pricing type */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t("pricingType")}</label>
        <input type="hidden" name="pricingType" value={pricingType} />
        <div className="mt-2 flex gap-3">
          {[
            { value: "FIXED", label: t("fixedPrice") },
            { value: "NEGOTIABLE", label: t("negotiable") },
          ].map((opt) => (
            <label key={opt.value} className={`cursor-pointer rounded-xl border px-4 py-2.5 text-sm transition-all ${pricingType === opt.value ? "border-primary bg-primary text-white shadow-md" : "glass-subtle text-foreground hover:bg-white/60 dark:hover:bg-white/10"}`}>
              <input type="radio" value={opt.value} checked={pricingType === opt.value} onChange={(e) => setPricingType(e.target.value)} className="sr-only" />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Price (only for FIXED) */}
      {pricingType === "FIXED" && (
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-foreground">{t("price")}</label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground">&euro;</span>
            <input id="price" name="price" type="number" step="0.01" min="0.01" required className="block w-48 glass-input px-3 py-2.5 text-foreground" />
          </div>
        </div>
      )}

      {/* Shipping cost */}
      <div>
        <label htmlFor="shippingCost" className="block text-sm font-medium text-foreground">{t("shippingCost")}</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">&euro;</span>
          <input id="shippingCost" name="shippingCost" type="number" step="0.01" min="0" required className="block w-48 glass-input px-3 py-2.5 text-foreground" />
        </div>
      </div>

      <button type="submit" disabled={pending} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50">
        {pending ? "..." : t("createTitle")}
      </button>
    </form>
  );
}
