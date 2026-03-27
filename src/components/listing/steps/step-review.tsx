"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X, ZoomIn, Star, TrendingUp, Zap } from "lucide-react";
import { calculateUpsellCost } from "@/lib/upsell-config";
import type { ListingType, DeliveryMethod, PackageSize, Carrier, UpsellType, CardItemEntry } from "@/types";

interface UpsellEntry {
  type: UpsellType;
  days: number;
}

interface FormData {
  listingType: ListingType;
  images: string[];
  title: string;
  description: string;
  cardName: string;
  cardSetId: string;
  selectedSeries: string;
  condition: string;
  cardItems: CardItemEntry[];
  estimatedCardCount: number | null;
  productType: string;
  itemCategory: string;
  pricingType: string;
  price: number | null;
  deliveryMethod: DeliveryMethod;
  freeShipping: boolean;
  shippingCost: number;
  carriers: Carrier[];
  packageSize: PackageSize | "";
  packageCount: number;
  upsells: UpsellEntry[];
}

interface ListingPreviewProps {
  form: FormData;
  isPremium: boolean;
  onBack: () => void;
  onPublish: () => void;
  pending: boolean;
  error?: string;
}

const UPSELL_ICONS: Record<UpsellType, typeof Star> = {
  HOMEPAGE_SPOTLIGHT: Star,
  CATEGORY_HIGHLIGHT: TrendingUp,
  URGENT_LABEL: Zap,
};

const UPSELL_KEYS: Record<UpsellType, string> = {
  HOMEPAGE_SPOTLIGHT: "upsellSpotlight",
  CATEGORY_HIGHLIGHT: "upsellHighlight",
  URGENT_LABEL: "upsellUrgent",
};

export function ListingPreview({ form, isPremium, onBack, onPublish, pending, error }: ListingPreviewProps) {
  const t = useTranslations("listing");
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const totalUpsellCost = form.upsells.reduce(
    (sum, entry) => sum + calculateUpsellCost(entry.type, entry.days, isPremium),
    0
  );

  const hasUrgent = form.upsells.some((u) => u.type === "URGENT_LABEL");
  const hasSpotlight = form.upsells.some((u) => u.type === "HOMEPAGE_SPOTLIGHT");

  const images = form.images;

  function prev() {
    setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  }

  function next() {
    setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));
  }

  return (
    <div className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 ${hasSpotlight ? "ring-2 ring-yellow-400/30 rounded-3xl" : ""}`}>
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
        <span>Marktplaats</span>
        <span>/</span>
        <span className="text-foreground">{form.title || t("titlePlaceholder")}</span>
      </nav>

      {/* Main content — exact same layout as listing detail page */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: Images & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image gallery — replicates ImageGallery component with plain img tags */}
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

                {/* Urgent badge */}
                {hasUrgent && (
                  <span className="absolute left-3 top-3 z-10 rounded-full bg-red-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                    {t("urgentBadge")}
                  </span>
                )}

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

          {/* Title & seller */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {form.title || <span className="text-muted-foreground italic">{t("titlePlaceholder")}</span>}
              </h1>
              <span className="mt-1 inline-block text-sm text-primary">
                {t("previewYou")}
              </span>
            </div>
          </div>

          {/* Card info */}
          <div className="glass-subtle rounded-2xl p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {form.listingType === "SINGLE_CARD" && form.cardName && (
                <div>
                  <p className="text-muted-foreground">{t("cardName")}</p>
                  <p className="font-medium text-foreground">{form.cardName}</p>
                </div>
              )}
              {form.listingType === "SINGLE_CARD" && form.condition && (
                <div>
                  <p className="text-muted-foreground">{t("condition")}</p>
                  <p className="font-medium text-foreground">{form.condition}</p>
                </div>
              )}
              {form.listingType === "MULTI_CARD" && form.cardItems.length > 0 && (
                <div>
                  <p className="text-muted-foreground">{t("cardName")}en</p>
                  <p className="font-medium text-foreground">{form.cardItems.length} kaarten</p>
                </div>
              )}
              {form.listingType === "COLLECTION" && form.estimatedCardCount && (
                <div>
                  <p className="text-muted-foreground">{t("estimatedCardCount")}</p>
                  <p className="font-medium text-foreground">{form.estimatedCardCount}</p>
                </div>
              )}
              {form.listingType === "SEALED_PRODUCT" && form.productType && (
                <div>
                  <p className="text-muted-foreground">{t("productType")}</p>
                  <p className="font-medium text-foreground">{form.productType}</p>
                </div>
              )}
              {form.listingType === "OTHER" && form.itemCategory && (
                <div>
                  <p className="text-muted-foreground">{t("itemCategory")}</p>
                  <p className="font-medium text-foreground">{form.itemCategory}</p>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {form.description && (
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("description")}</h2>
              <div className="mt-2 whitespace-pre-wrap text-muted-foreground prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: form.description }} />
            </div>
          )}
        </div>

        {/* Right: Pricing sidebar */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6">
            <div className="text-center">
              {form.pricingType === "FIXED" ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("price")}</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">
                    &euro;{form.price?.toFixed(2) ?? "0.00"}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t("pricingType")}</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{t("negotiable")}</p>
                </>
              )}
            </div>

            <div className="mt-3 text-center text-sm text-muted-foreground">
              {form.freeShipping
                ? t("freeShipping")
                : form.deliveryMethod === "PICKUP"
                  ? t("deliveryPickup")
                  : `+ \u20AC${form.shippingCost.toFixed(2)} ${t("shippingCost").toLowerCase()}`
              }
            </div>

            {/* Carrier badges */}
            {form.carriers.length > 0 && (
              <div className="mt-3 flex justify-center gap-2">
                {form.carriers.map((c) => (
                  <span key={c} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
            )}

            {/* Placeholder contact button */}
            <div className="mt-6">
              <div className="w-full rounded-xl bg-primary/20 py-2.5 text-center text-sm font-medium text-primary/60 cursor-not-allowed">
                {t("previewContactButton")}
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

      {/* Upsells cost overview (not part of the real listing page, but important info for the seller) */}
      {form.upsells.length > 0 && (
        <div className="mt-8 glass rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t("reviewUpsells")}</h3>
          <div className="flex flex-wrap gap-2">
            {form.upsells.map((entry) => {
              const Icon = UPSELL_ICONS[entry.type];
              const cost = calculateUpsellCost(entry.type, entry.days, isPremium);
              return (
                <div key={entry.type} className="flex items-center gap-2 glass-subtle rounded-lg px-3 py-2 text-sm">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-foreground">{t(UPSELL_KEYS[entry.type])}</span>
                  <span className="text-muted-foreground">({entry.days}d)</span>
                  <span className="font-semibold text-foreground">&euro;{cost.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border/50 pt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">{t("upsellTotal")}</span>
            <span className="font-bold text-foreground">&euro;{totalUpsellCost.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("upsellDeductNotice")}</p>
        </div>
      )}

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
