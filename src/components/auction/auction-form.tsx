"use client";

import { useTranslations } from "next-intl";
import { createAuction } from "@/actions/auction";
import { useActionState, useState } from "react";
import { CARD_CONDITIONS } from "@/types";
import { ImageUploader } from "@/components/ui/image-uploader";
import type { Series, CardSet } from "@prisma/client";

type SeriesWithSets = Series & { cardSets: CardSet[] };

export function AuctionForm({ seriesList }: { seriesList: SeriesWithSets[] }) {
  const t = useTranslations("auction");
  const ttcg = useTranslations("tcg");

  const [auctionType, setAuctionType] = useState("SINGLE_CARD");
  const [selectedSeries, setSelectedSeries] = useState("");
  const [hasReserve, setHasReserve] = useState(false);
  const [hasBuyNow, setHasBuyNow] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const series = seriesList.find((s) => s.id === selectedSeries);

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null | undefined, formData: FormData) => {
      const result = await createAuction(formData);
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

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t("type")}</label>
        <div className="mt-2 flex gap-3">
          {[
            { value: "SINGLE_CARD", label: t("singleCard") },
            { value: "COLLECTION", label: t("collection") },
            { value: "BULK", label: t("bulk") },
          ].map((opt) => (
            <label key={opt.value} className={`cursor-pointer rounded-xl border px-4 py-2.5 text-sm transition-all ${auctionType === opt.value ? "border-primary bg-primary text-white shadow-md" : "glass-subtle text-foreground hover:bg-white/60 dark:hover:bg-white/10"}`}>
              <input type="radio" name="auctionType" value={opt.value} checked={auctionType === opt.value} onChange={(e) => setAuctionType(e.target.value)} className="sr-only" />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Card details for SINGLE_CARD */}
      {auctionType === "SINGLE_CARD" && (
        <>
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
          <div>
            <label htmlFor="cardName" className="block text-sm font-medium text-foreground">{t("cardName")}</label>
            <input id="cardName" name="cardName" type="text" className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">{t("condition")}</label>
            <select name="condition" className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground">
              {CARD_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </>
      )}

      {/* Images */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">{t("photos")}</label>
        <input type="hidden" name="imageUrls" value={JSON.stringify(images)} />
        <ImageUploader images={images} onChange={setImages} maxImages={10} />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-foreground">{t("description")}</label>
        <textarea id="description" name="description" rows={4} className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground" />
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startingBid" className="block text-sm font-medium text-foreground">{t("startingBid")}</label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground">€</span>
            <input id="startingBid" name="startingBid" type="number" step="0.01" min="0.01" required className="block w-full glass-input px-3 py-2.5 text-foreground" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t("duration")}</label>
          <select name="duration" className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground">
            {[1, 3, 5, 7].map((d) => <option key={d} value={d}>{d} {t("days")}</option>)}
          </select>
        </div>
      </div>

      {/* Reserve price */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" checked={hasReserve} onChange={(e) => setHasReserve(e.target.checked)} className="rounded" />
          {t("reservePrice")}
        </label>
        {hasReserve && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">€</span>
            <input name="reservePrice" type="number" step="0.01" min="0.01" className="block w-48 glass-input px-3 py-2.5 text-foreground" />
            <p className="text-xs text-muted-foreground">{t("reservePriceHelp")}</p>
          </div>
        )}
      </div>

      {/* Buy now price */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" checked={hasBuyNow} onChange={(e) => setHasBuyNow(e.target.checked)} className="rounded" />
          {t("buyNowPrice")}
        </label>
        {hasBuyNow && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">€</span>
            <input name="buyNowPrice" type="number" step="0.01" min="0.01" className="block w-48 glass-input px-3 py-2.5 text-foreground" />
            <p className="text-xs text-muted-foreground">{t("buyNowPriceHelp")}</p>
          </div>
        )}
      </div>

      <button type="submit" disabled={pending} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50">
        {pending ? "..." : t("createTitle")}
      </button>
    </form>
  );
}
