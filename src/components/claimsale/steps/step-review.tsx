"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  Clock,
  Calendar,
  Truck,
  Tag,
  Banknote,
  LayoutGrid,
} from "lucide-react";
import {
  deriveClaimsaleStartTime,
  isClaimsaleScheduled,
  formatNLDateTime,
} from "@/lib/claimsale/timing";
import { applyFreeUpsellsToCost } from "@/lib/upsell-config";
import { calculateClaimsaleLabelCost } from "@/lib/claimsale/labels";
import { CLAIMSALE_LABEL_TEXT_NL } from "../claimsale-labels";
import type { ClaimsaleFormState, ClaimsaleItemDraft } from "../wizard-types";

interface ClaimsalePreviewProps {
  form: ClaimsaleFormState;
  onBack: () => void;
  onPublish: () => void;
  pending: boolean;
  error?: string;
  accountType?: string;
  freeUpsellsRemaining?: number;
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function itemDisplayImage(item: ClaimsaleItemDraft, type: string): string | null {
  if (type === "CARDS") {
    return item.frontImage ?? item.tcgdex?.imageUrl ?? null;
  }
  return item.itemImages[0] ?? null;
}

function itemDisplayName(item: ClaimsaleItemDraft, type: string, idx: number): string {
  if (type === "CARDS") {
    return item.cardName || item.tcgdex?.name || `Kaart ${idx + 1}`;
  }
  return item.itemName || `Item ${idx + 1}`;
}

const UPSELL_LABEL: Record<string, string> = {
  HOMEPAGE_SPOTLIGHT: "Homepage Spotlight",
  CATEGORY_HIGHLIGHT: "Categorie-uitlichting",
  ITEM_PREVIEW: "Kaart-preview-rij",
};

export function ClaimsalePreview({
  form,
  onBack,
  onPublish,
  pending,
  error,
  accountType = "FREE",
  freeUpsellsRemaining = 0,
}: ClaimsalePreviewProps) {
  const t = useTranslations("claimsale");
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const startTime = deriveClaimsaleStartTime(form.startDate);
  const scheduled = isClaimsaleScheduled(startTime);

  // Galerij = cover + alle item-afbeeldingen (gededupliceerd).
  const galleryImages = Array.from(
    new Set(
      [
        form.coverImage,
        ...form.items.map((i) => itemDisplayImage(i, form.type)),
      ].filter((u): u is string => !!u)
    )
  );

  const prices = form.items
    .map((i) => parseFloat(i.price))
    .filter((p) => !Number.isNaN(p) && p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  function prev() {
    setCurrent((c) => (c === 0 ? galleryImages.length - 1 : c - 1));
  }
  function next() {
    setCurrent((c) => (c === galleryImages.length - 1 ? 0 : c + 1));
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 glass-subtle rounded-xl px-4 py-2.5 text-sm text-foreground transition-all hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" /> {t("backToEdit")}
        </button>
        <div className="text-right">
          <h2 className="text-lg font-semibold text-foreground">{t("reviewTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("reviewSubtitle")}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Galerij */}
          <div className="space-y-3">
            {galleryImages.length > 0 ? (
              <>
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={galleryImages[current]}
                    alt={form.title || "Preview"}
                    className="h-full w-full cursor-zoom-in object-contain"
                    onClick={() => setLightbox(true)}
                  />
                  <button
                    type="button"
                    onClick={() => setLightbox(true)}
                    className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white transition-opacity hover:bg-black/70"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  {galleryImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={prev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={next}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
                {galleryImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {galleryImages.map((url, i) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setCurrent(i)}
                        className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg transition-all ${
                          i === current ? "ring-2 ring-primary ring-offset-2" : "opacity-60 hover:opacity-100"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-muted text-sm text-muted-foreground">
                {t("noImages")}
              </div>
            )}
          </div>

          {/* Identiteit */}
          <div className="space-y-4">
            <div>
              <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary dark:bg-red-950 dark:text-red-400">
                {form.type === "CARDS" ? t("typeCards") : t("typeItems")}
              </span>
              <h1 className="mt-2 text-2xl font-bold text-foreground">
                {form.title || <span className="italic text-muted-foreground">{t("titlePlaceholder")}</span>}
              </h1>
            </div>
            {form.description && (
              <SectionCard icon={Tag} title={t("description")}>
                <p className="whitespace-pre-wrap text-sm text-foreground">{form.description}</p>
              </SectionCard>
            )}
            <SectionCard icon={Banknote} title={t("reviewPriceRange")}>
              <p className="text-sm text-foreground">
                {minPrice === null
                  ? "—"
                  : minPrice === maxPrice
                    ? `€${minPrice.toFixed(2)}`
                    : `€${minPrice!.toFixed(2)} – €${maxPrice!.toFixed(2)}`}
                <span className="ml-2 text-xs text-muted-foreground">
                  ({form.items.length} {form.items.length === 1 ? "item" : "items"})
                </span>
              </p>
            </SectionCard>
          </div>
        </div>

        {/* Inhoud */}
        <SectionCard icon={LayoutGrid} title={t("reviewContent")}>
          <ul className="divide-y divide-border/60">
            {form.items.map((item, idx) => {
              const img = itemDisplayImage(item, form.type);
              return (
                <li key={item.id} className="flex items-center gap-3 py-2 first:pt-0">
                  <span className="w-6 shrink-0 text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {itemDisplayName(item, form.type, idx)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {item.condition}
                      {item.sellerNote ? ` · ${item.sellerNote}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    {item.price ? `€${parseFloat(item.price).toFixed(2)}` : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>

        {/* Verzending */}
        <SectionCard icon={Truck} title={t("stepVerzending")}>
          <p className="text-sm text-foreground">
            {form.allowMailbox ? t("reviewMailboxAllowed") : t("reviewMailboxNotAllowed")}
          </p>
        </SectionCard>

        {/* Timing */}
        <SectionCard icon={Calendar} title={t("stepTiming")}>
          <div
            className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
              scheduled
                ? "border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20"
                : "border-emerald-300 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20"
            }`}
          >
            <Clock
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                scheduled ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            />
            <p
              className={
                scheduled ? "text-amber-800 dark:text-amber-300" : "text-emerald-800 dark:text-emerald-300"
              }
            >
              {scheduled
                ? t("scheduledStartHint", { date: formatNLDateTime(startTime) })
                : t("instantStartHint")}
            </p>
          </div>
        </SectionCard>

        {/* Promotie-kosten */}
        <PromotionCostBlock
          upsells={form.upsells}
          labels={form.labels}
          accountType={accountType}
          freeUpsellsRemaining={freeUpsellsRemaining}
        />
      </div>

      {/* Sticky publish bar */}
      <div className="sticky bottom-4 z-10 mt-8">
        <div className="glass flex items-center justify-between rounded-2xl p-4 shadow-lg">
          <button
            type="button"
            onClick={onBack}
            className="glass-subtle rounded-xl px-4 py-2.5 text-sm text-foreground transition-all hover:bg-muted"
          >
            {t("backToEdit")}
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={pending}
            className="rounded-xl bg-primary px-8 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
          >
            {pending ? "..." : t("publishConfirm")}
          </button>
        </div>
      </div>

      {lightbox && galleryImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="relative h-[85vh] w-[85vw]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={galleryImages[current]} alt="" className="h-full w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

function PromotionCostBlock({
  upsells,
  labels,
  accountType,
  freeUpsellsRemaining,
}: {
  upsells: ClaimsaleFormState["upsells"];
  labels: ClaimsaleFormState["labels"];
  accountType: string;
  freeUpsellsRemaining: number;
}) {
  const t = useTranslations("claimsale");
  if (upsells.length === 0 && labels.length === 0) return null;

  const allocation = applyFreeUpsellsToCost(
    upsells.map((u) => ({ type: u.type, days: u.days })),
    accountType,
    freeUpsellsRemaining,
    "claimsale"
  );
  const labelCost = calculateClaimsaleLabelCost(labels.length);
  const totalCost = Math.round((allocation.total + labelCost) * 100) / 100;

  const formatPrice = (n: number) => (n === 0 ? "Gratis" : `€${n.toFixed(2).replace(".", ",")}`);

  return (
    <SectionCard icon={Banknote} title={t("reviewCosts")}>
      <ul className="divide-y divide-border/60 text-sm">
        {upsells.map((u, i) => {
          const cost = allocation.perEntry[i] ?? 0;
          const isFree = cost === 0;
          return (
            <li key={`${u.type}-${i}`} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">{UPSELL_LABEL[u.type] ?? u.type}</div>
                <div className="text-xs text-muted-foreground">
                  {u.days} {u.days === 1 ? "dag" : "dagen"}
                </div>
              </div>
              <span
                className={`font-medium ${isFree ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
              >
                {formatPrice(cost)}
              </span>
            </li>
          );
        })}
        {labels.length > 0 && (
          <li className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground">
                {labels.length} {labels.length === 1 ? "Label" : "Labels"}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({labels.map((l) => CLAIMSALE_LABEL_TEXT_NL[l.type]).join(", ")})
                </span>
              </div>
              <div className="text-xs text-muted-foreground">Eenmalig per claimsale</div>
            </div>
            <span className="font-medium text-foreground">{formatPrice(labelCost)}</span>
          </li>
        )}
      </ul>
      <div className="mt-3 flex items-baseline justify-between rounded-lg bg-muted px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">Totaal direct van saldo</span>
        <span className="text-base font-bold text-foreground">{formatPrice(totalCost)}</span>
      </div>
    </SectionCard>
  );
}
