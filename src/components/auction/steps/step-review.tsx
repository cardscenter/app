"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X, ZoomIn, Clock } from "lucide-react";
import type { AuctionType } from "@/types";

interface AuctionFormData {
  auctionType: AuctionType;
  images: string[];
  title: string;
  description: string;
  cardName: string;
  cardSetId: string;
  selectedSeries: string;
  condition: string;
  startingBid: number | null;
  duration: number;
  hasReserve: boolean;
  reservePrice: number | null;
  hasBuyNow: boolean;
  buyNowPrice: number | null;
}

interface AuctionPreviewProps {
  form: AuctionFormData;
  onBack: () => void;
  onPublish: () => void;
  pending: boolean;
  error?: string;
}

export function AuctionPreview({ form, onBack, onPublish, pending, error }: AuctionPreviewProps) {
  const t = useTranslations("auction");
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const images = form.images;

  function prev() {
    setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  }

  function next() {
    setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));
  }

  // Calculate end time for display
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + form.duration);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header bar */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 glass-subtle rounded-xl px-4 py-2.5 text-sm text-foreground transition-all hover:bg-white/60 dark:hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" /> {t("backToEdit")}
        </button>
        <h2 className="text-lg font-semibold text-foreground">{t("previewTitle")}</h2>
      </div>

      {error && (
        <div className="mb-6 glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Breadcrumbs mock */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{t("breadcrumbAuctions")}</span>
        <span>/</span>
        <span className="text-foreground">{form.title || t("titlePlaceholder")}</span>
      </nav>

      {/* Main content — same layout as auction detail page */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: Images & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image gallery */}
          {images.length > 0 && (
            <>
              <div className="relative aspect-square overflow-hidden rounded-2xl glass">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[current]}
                  alt={`${form.title || t("previewTitle")} ${current + 1}`}
                  className="h-full w-full object-contain cursor-zoom-in"
                  onClick={() => setLightbox(true)}
                />

                {/* Zoom hint */}
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white transition-opacity hover:bg-black/70"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>

                {/* Navigation arrows */}
                {images.length > 1 && (
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

                {/* Indicator dots */}
                {images.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrent(i)}
                        className={`h-2 w-2 rounded-full transition-all ${
                          i === current
                            ? "bg-white w-4"
                            : "bg-white/50 hover:bg-white/75"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setCurrent(i)}
                      className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl transition-all ${
                        i === current
                          ? "ring-2 ring-primary ring-offset-2"
                          : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`${form.title} ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Title & type badge */}
          <div>
            <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary dark:bg-red-950 dark:text-red-400">
              {form.auctionType === "SINGLE_CARD" ? t("singleCard") : form.auctionType === "COLLECTION" ? t("collection") : t("bulk")}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-foreground">
              {form.title || <span className="text-muted-foreground italic">{t("titlePlaceholder")}</span>}
            </h1>
            <span className="mt-1 inline-block text-sm text-primary">
              {t("previewYou")}
            </span>
          </div>

          {/* Card info */}
          {form.auctionType === "SINGLE_CARD" && form.cardName && (
            <div className="glass-subtle rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">{t("cardName")}</p>
              <p className="font-medium text-foreground">{form.cardName}</p>
              {form.condition && <p className="text-sm text-muted-foreground mt-1">{t("condition")}: {form.condition}</p>}
            </div>
          )}

          {/* Description */}
          {form.description && (
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("description")}</h2>
              <div className="mt-2 whitespace-pre-wrap text-muted-foreground prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: form.description }} />
            </div>
          )}

          {/* Bid history placeholder */}
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("bidHistory")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("noBids")}</p>
          </div>
        </div>

        {/* Right: Bidding sidebar */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("startingBid")}</p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                &euro;{(form.startingBid ?? 0).toFixed(2)}
              </p>
            </div>

            {/* Reserve status */}
            {form.hasReserve && form.reservePrice && (
              <div className="mt-3 text-center">
                <span className="rounded-full bg-warning-light px-3 py-1 text-xs font-medium text-warning dark:bg-yellow-950 dark:text-yellow-400">
                  {t("reserveNotMet")}
                </span>
              </div>
            )}

            {/* Timer mock */}
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">{t("timeLeft")}</p>
              <div className="mt-1 flex items-center justify-center gap-1 text-lg font-semibold text-foreground">
                <Clock className="h-5 w-5 text-primary" />
                {form.duration} {t("days")}
              </div>
            </div>

            {/* Buy now */}
            {form.hasBuyNow && form.buyNowPrice && (
              <div className="mt-4 border-t border-border/50 pt-4 text-center">
                <p className="text-sm text-muted-foreground">{t("buyNowPrice")}</p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  &euro;{form.buyNowPrice.toFixed(2)}
                </p>
                <div className="mt-3 w-full rounded-xl bg-primary/20 py-2.5 text-center text-sm font-medium text-primary/60 cursor-not-allowed">
                  {t("buyNow")}
                </div>
              </div>
            )}

            {/* Placeholder bid button */}
            <div className="mt-6">
              <div className="w-full rounded-xl bg-primary/20 py-2.5 text-center text-sm font-medium text-primary/60 cursor-not-allowed">
                {t("placeBid")}
              </div>
            </div>
          </div>

          {/* Social share placeholder */}
          <div className="glass-subtle rounded-2xl p-4">
            <div className="flex gap-2 justify-center">
              <span className="h-8 w-8 rounded-full bg-muted" />
              <span className="h-8 w-8 rounded-full bg-muted" />
              <span className="h-8 w-8 rounded-full bg-muted" />
            </div>
          </div>
        </div>
      </div>

      {/* Publish bar */}
      <div className="sticky bottom-4 z-10 mt-8">
        <div className="glass rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <button
            type="button"
            onClick={onBack}
            className="glass-subtle rounded-xl px-4 py-2.5 text-sm text-foreground transition-all hover:bg-white/60 dark:hover:bg-white/10"
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

      {/* Lightbox */}
      {lightbox && (
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

          <div
            className="relative h-[85vh] w-[85vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[current]}
              alt={`${form.title} ${current + 1}`}
              className="h-full w-full object-contain"
            />
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white">
            {current + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}
