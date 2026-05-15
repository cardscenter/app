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
  MapPin,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Tag,
  Banknote,
  Sparkles,
  RotateCcw,
  Info,
} from "lucide-react";
import type { AuctionType, UpsellType } from "@/types";
import { deriveAuctionWindow, formatNLDateTime, SCHEDULED_THRESHOLD_MS } from "@/lib/auction/timing";
import { AUCTION_BUYER_PREMIUM_RATE } from "@/lib/auction/fees";
import { applyFreeUpsellsToCost } from "@/lib/upsell-config";
import { calculateLabelCost, type LabelColor, type LabelType } from "@/lib/auction/labels";

interface UpsellEntry {
  type: string;
  // Nieuwe vorm (Fase 33+): dual-handle window in dagen vanaf veiling-start.
  startDay: number;
  endDay: number;
}

interface SelectedLabel {
  type: LabelType;
  colorKey: LabelColor;
}

interface AuctionFormData {
  auctionType: AuctionType;
  images: string[];
  title: string;
  description: string;
  cardName: string;
  condition: string;
  variant?: "normal" | "reverse";
  productType: string;
  itemCategory: string;
  startingBid: number | null;
  duration: number;
  startDate: Date;
  endTimeOfDay: string;
  hasReserve: boolean;
  reservePrice: number | null;
  hasBuyNow: boolean;
  buyNowPrice: number | null;
  runnerUpEnabled?: boolean;
  deliveryMethod?: "SHIP" | "PICKUP" | "BOTH";
  allowMailbox?: boolean;
  upsells?: UpsellEntry[];
  labels?: SelectedLabel[];
}

interface AuctionPreviewProps {
  form: AuctionFormData;
  onBack: () => void;
  onPublish: () => void;
  pending: boolean;
  error?: string;
  userCity?: string | null;
  maxRunnerUpAttempts?: number;
  /** Voor het kosten-overzicht: tier-discount + free-quota allocatie. */
  accountType?: string;
  freeUpsellsRemaining?: number;
}

const TYPE_KEYS: Record<AuctionType, string> = {
  SINGLE_CARD: "singleCard",
  MULTI_CARD: "multiCard",
  COLLECTION: "collection",
  SEALED_PRODUCT: "sealedProduct",
  OTHER: "other",
};

const UPSELL_LABELS: Record<string, string> = {
  HOMEPAGE_SPOTLIGHT: "upsellSpotlight",
  CATEGORY_HIGHLIGHT: "upsellHighlight",
  URGENT_LABEL: "upsellUrgent",
};

interface SectionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  variant?: "default" | "amber" | "emerald";
}

function SectionCard({ icon: Icon, title, children, variant = "default" }: SectionCardProps) {
  const variantClasses =
    variant === "amber"
      ? "border-amber-300 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20"
      : variant === "emerald"
        ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/20"
        : "border-border bg-card";
  return (
    <div className={`rounded-2xl border p-5 ${variantClasses}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

interface InfoRowProps {
  label: string;
  children: React.ReactNode;
  emphasize?: boolean;
}

function InfoRow({ label, children, emphasize }: InfoRowProps) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={emphasize ? "font-semibold text-foreground" : "text-foreground"}>{children}</dd>
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function AuctionPreview({
  form,
  onBack,
  onPublish,
  pending,
  error,
  userCity = null,
  maxRunnerUpAttempts = 2,
  accountType = "FREE",
  freeUpsellsRemaining = 0,
}: AuctionPreviewProps) {
  const t = useTranslations("auction");
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const images = form.images;

  const window = deriveAuctionWindow({
    startDate: form.startDate,
    duration: form.duration,
    endTimeOfDay: form.endTimeOfDay,
  });
  const isScheduled = window.startTime.getTime() > Date.now() + SCHEDULED_THRESHOLD_MS;

  const startBid = form.startingBid ?? 0;
  const reserve = form.hasReserve && form.reservePrice ? form.reservePrice : null;
  const buyNow = form.hasBuyNow && form.buyNowPrice ? form.buyNowPrice : null;
  const premiumRate = AUCTION_BUYER_PREMIUM_RATE;
  const premiumLabel = `${(premiumRate * 100).toFixed(1).replace(/\.0$/, "")}%`;

  // Bereken voorbeeld-buyer-totaal voor de prijs-uitleg (op basis van startBid)
  const exampleBuyerTotal = startBid * (1 + premiumRate);

  const deliveryLabel =
    form.deliveryMethod === "PICKUP"
      ? t("deliveryPickup")
      : form.deliveryMethod === "BOTH"
        ? t("deliveryBoth")
        : t("deliveryShip");

  function prev() {
    setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  }
  function next() {
    setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      {/* Header */}
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
        {/* Top: foto + identiteit */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Image gallery */}
          <div className="space-y-3">
            {images.length > 0 ? (
              <>
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[current]}
                    alt={`${form.title || "Preview"} ${current + 1}`}
                    className="h-full w-full cursor-zoom-in object-contain"
                    onClick={() => setLightbox(true)}
                  />
                  <button
                    type="button"
                    onClick={() => setLightbox(true)}
                    className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white transition-opacity hover:bg-black/70"
                    aria-label={t("zoom")}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
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
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map((url, i) => (
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
                {t(TYPE_KEYS[form.auctionType])}
              </span>
              <h1 className="mt-2 text-2xl font-bold text-foreground">
                {form.title || <span className="italic text-muted-foreground">{t("titlePlaceholder")}</span>}
              </h1>
            </div>

            {/* Item-specifieke details */}
            <SectionCard icon={Tag} title={t("reviewItemDetails")}>
              <dl className="space-y-2">
                {form.auctionType === "SINGLE_CARD" && form.cardName && (
                  <InfoRow label={t("cardName")}>
                    {form.cardName}
                    {form.variant === "reverse" && <span className="text-muted-foreground"> (Reverse Holo)</span>}
                  </InfoRow>
                )}
                {(form.auctionType === "SINGLE_CARD" || form.auctionType === "MULTI_CARD") && form.condition && (
                  <InfoRow label={t("condition")}>{form.condition}</InfoRow>
                )}
                {form.auctionType === "SEALED_PRODUCT" && form.productType && (
                  <InfoRow label={t("summaryProductType")}>{form.productType}</InfoRow>
                )}
                {form.auctionType === "OTHER" && form.itemCategory && (
                  <InfoRow label={t("summaryItemCategory")}>{form.itemCategory}</InfoRow>
                )}
              </dl>
            </SectionCard>

            {/* Beschrijving */}
            {form.description && stripHtml(form.description).length > 0 && (
              <SectionCard icon={Tag} title={t("description")}>
                <div
                  className="prose prose-sm max-w-none text-sm text-foreground dark:prose-invert [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: form.description }}
                />
              </SectionCard>
            )}
          </div>
        </div>

        {/* Prijzen + verkoop-conditie */}
        <SectionCard icon={Banknote} title={t("reviewPricing")}>
          <dl className="space-y-2">
            <InfoRow label={t("startingBid")} emphasize>
              €{startBid.toFixed(2)}
            </InfoRow>
            {reserve !== null && (
              <InfoRow label={t("reservePrice")} emphasize>
                €{reserve.toFixed(2)}
              </InfoRow>
            )}
            {buyNow !== null && (
              <InfoRow label={t("buyNowPrice")} emphasize>
                €{buyNow.toFixed(2)}
              </InfoRow>
            )}
          </dl>

          {/* Sale-conditie: reserve aan/uit met expliciete uitleg */}
          {reserve !== null ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">{t("reviewReserveTitle")}</p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  {t("reviewReserveExplain", { amount: `€${reserve.toFixed(2)}` })}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/20">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="text-sm">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">{t("reviewNoReserveTitle")}</p>
                <p className="mt-0.5 text-emerald-800 dark:text-emerald-300">{t("reviewNoReserveExplain")}</p>
              </div>
            </div>
          )}

          {buyNow !== null && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-xs">
                <p className="font-medium text-foreground">{t("reviewBuyNowTitle")}</p>
                <p className="mt-0.5 text-muted-foreground">
                  {t("reviewBuyNowExplain", {
                    amount: `€${buyNow.toFixed(2)}`,
                    cutoff: `€${(buyNow * 0.75).toFixed(2)}`,
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Buyer's premium */}
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-xs">
              <p className="font-medium text-foreground">{t("reviewPremiumTitle", { rate: premiumLabel })}</p>
              <p className="mt-0.5 text-muted-foreground">
                {t("reviewPremiumExplain", {
                  rate: premiumLabel,
                  start: `€${startBid.toFixed(2)}`,
                  total: `€${exampleBuyerTotal.toFixed(2)}`,
                })}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Tijdvenster */}
        <SectionCard icon={Calendar} title={t("stepTiming")}>
          <dl className="space-y-2">
            <InfoRow label={t("duration")}>
              {form.duration} {t("days")}
            </InfoRow>
            <InfoRow label={t("summaryStartsAt")}>{formatNLDateTime(window.startTime)}</InfoRow>
            <InfoRow label={t("summaryEndsAt")} emphasize>
              {formatNLDateTime(window.endTime)}
            </InfoRow>
          </dl>
          <div
            className={`mt-3 flex items-start gap-3 rounded-xl border p-3 text-sm ${
              isScheduled
                ? "border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20"
                : "border-emerald-300 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20"
            }`}
          >
            <Clock
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                isScheduled ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            />
            <p className={isScheduled ? "text-amber-800 dark:text-amber-300" : "text-emerald-800 dark:text-emerald-300"}>
              {isScheduled
                ? t("reviewScheduledExplain", { date: formatNLDateTime(window.startTime) })
                : t("reviewInstantExplain")}
            </p>
          </div>
        </SectionCard>

        {/* Verzending */}
        <SectionCard icon={Truck} title={t("deliveryHeader")}>
          <dl className="space-y-2">
            <InfoRow label={t("summaryDelivery")} emphasize>
              {deliveryLabel}
            </InfoRow>
            {(form.deliveryMethod === "PICKUP" || form.deliveryMethod === "BOTH") && (
              <InfoRow label={t("summaryPickupCity")}>
                {userCity ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {userCity}
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">{t("pickupLocationMissing")}</span>
                )}
              </InfoRow>
            )}
            {(form.deliveryMethod === "SHIP" || form.deliveryMethod === "BOTH") && form.allowMailbox && (
              <InfoRow label={t("reviewMailboxParcel")}>{t("reviewMailboxAllowed")}</InfoRow>
            )}
          </dl>
        </SectionCard>

        {/* Promotie + Runner-up */}
        {((form.upsells && form.upsells.length > 0) || form.runnerUpEnabled !== undefined) && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {form.upsells && form.upsells.length > 0 && (
              <SectionCard icon={Sparkles} title={t("stepUpsells")}>
                <ul className="space-y-2 text-sm">
                  {form.upsells.map((u, i) => {
                    const days = Math.max(0, u.endDay - u.startDay + 1);
                    return (
                      <li key={`${u.type}-${i}`} className="flex items-baseline justify-between gap-3">
                        <span className="text-foreground">
                          {UPSELL_LABELS[u.type] ? t(UPSELL_LABELS[u.type]) : u.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {days} {t("days")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            )}
            <SectionCard icon={RotateCcw} title={t("reviewRunnerUpTitle")}>
              {maxRunnerUpAttempts > 0 && form.runnerUpEnabled ? (
                <div className="flex items-start gap-2 text-sm text-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("reviewRunnerUpEnabled", { count: maxRunnerUpAttempts })}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("reviewRunnerUpDisabled")}</p>
              )}
            </SectionCard>
          </div>
        )}

        {/* Te betalen kosten — alleen tonen als er promotie/labels zijn gekozen */}
        <PromotionCostBlock
          upsells={form.upsells ?? []}
          labels={form.labels ?? []}
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

      {/* Lightbox */}
      {lightbox && images.length > 0 && (
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
            <img src={images[current]} alt="" className="h-full w-full object-contain" />
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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white">
            {current + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}

// Te betalen kosten-overzicht. Toont alleen iets als er upsells of labels zijn.
// Free-quota wordt visueel gemarkeerd als "Gratis (PRO/Unlimited)".
function PromotionCostBlock({
  upsells,
  labels,
  accountType,
  freeUpsellsRemaining,
}: {
  upsells: UpsellEntry[];
  labels: SelectedLabel[];
  accountType: string;
  freeUpsellsRemaining: number;
}) {
  if (upsells.length === 0 && labels.length === 0) return null;

  // Hergebruikt de exacte server-side allocator voor exacte parity.
  const allocation = applyFreeUpsellsToCost(
    upsells.map((u) => ({
      type: u.type as UpsellType,
      days: Math.max(0, u.endDay - u.startDay + 1),
    })),
    accountType,
    freeUpsellsRemaining,
    "auction",
  );

  const labelCost = calculateLabelCost(labels.length);
  const totalCost = Math.round((allocation.total + labelCost) * 100) / 100;

  const formatPrice = (n: number) =>
    n === 0
      ? "Gratis"
      : `€${n.toFixed(2).replace(".", ",")}`;

  const upsellLabel: Record<string, string> = {
    HOMEPAGE_SPOTLIGHT: "Homepage Spotlight",
    CATEGORY_HIGHLIGHT: "Category Highlight",
  };

  return (
    <SectionCard icon={Banknote} title="Te betalen kosten">
      <ul className="divide-y divide-border/60 text-sm">
        {upsells.map((u, i) => {
          const days = Math.max(0, u.endDay - u.startDay + 1);
          const cost = allocation.perEntry[i] ?? 0;
          const isFree = cost === 0;
          return (
            <li
              key={`${u.type}-${i}`}
              className="flex items-baseline justify-between gap-3 py-2 first:pt-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">
                  {upsellLabel[u.type] ?? u.type}
                </div>
                <div className="text-xs text-muted-foreground">
                  Dag {u.startDay} t/m {u.endDay} · {days}{" "}
                  {days === 1 ? "dag" : "dagen"}
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`font-medium ${isFree ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
                >
                  {formatPrice(cost)}
                </span>
                {isFree && (
                  <div className="text-[10px] uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80">
                    Gratis quota
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {labels.length > 0 && (
          <li className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground">
                {labels.length} {labels.length === 1 ? "Label" : "Labels"}
              </div>
              <div className="text-xs text-muted-foreground">Eenmalig per veiling</div>
            </div>
            <span className="font-medium text-foreground">
              {formatPrice(labelCost)}
            </span>
          </li>
        )}
      </ul>
      <div className="mt-3 flex items-baseline justify-between rounded-lg bg-muted px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">
          Totaal direct van saldo
        </span>
        <span className="text-base font-bold text-foreground">
          {formatPrice(totalCost)}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Bedrag wordt direct van je saldo afgeschreven bij publiceren. Bij
        annuleren zonder biedingen wordt het naar rato teruggestort (spotlights
        pro-rata, labels volledig).
      </p>
    </SectionCard>
  );
}
