"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Clock, Image as ImageIcon, ListChecks } from "lucide-react";
import { deriveAuctionWindow, formatNLDateTime, SCHEDULED_THRESHOLD_MS } from "@/lib/auction/timing";
import type { AuctionType } from "@/types";

interface AuctionFormSummaryProps {
  auctionType: AuctionType;
  images: string[];
  title: string;
  description: string;
  cardName: string;
  condition: string;
  productType: string;
  itemCategory: string;
  startingBid: number | null;
  hasReserve: boolean;
  reservePrice: number | null;
  hasBuyNow: boolean;
  buyNowPrice: number | null;
  duration: number;
  startDate: Date;
  endTimeOfDay: string;
  deliveryMethod: "SHIP" | "PICKUP" | "BOTH";
  pickupCity?: string | null;
  upsellsCount: number;
}

const TYPE_KEYS: Record<AuctionType, string> = {
  SINGLE_CARD: "singleCard",
  MULTI_CARD: "multiCard",
  COLLECTION: "collection",
  SEALED_PRODUCT: "sealedProduct",
  OTHER: "other",
};

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

function formatPrice(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `€${value.toFixed(2)}`;
}

interface RowProps {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}

function Row({ label, children, muted }: RowProps) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={muted ? "text-muted-foreground" : "font-medium text-foreground"}>{children}</dd>
    </div>
  );
}

export function AuctionFormSummary({
  auctionType,
  images,
  title,
  description,
  cardName,
  condition,
  productType,
  itemCategory,
  startingBid,
  hasReserve,
  reservePrice,
  hasBuyNow,
  buyNowPrice,
  duration,
  startDate,
  endTimeOfDay,
  deliveryMethod,
  pickupCity,
  upsellsCount,
}: AuctionFormSummaryProps) {
  const t = useTranslations("auction");
  const window = deriveAuctionWindow({ startDate, duration, endTimeOfDay });
  const isScheduled = window.startTime.getTime() > Date.now() + SCHEDULED_THRESHOLD_MS;
  const firstImage = images[0];

  const plainDescription = description ? stripHtml(description) : "";
  const SUMMARY_DESCRIPTION_MAX = 120;
  const trimmedDescription =
    plainDescription.length > SUMMARY_DESCRIPTION_MAX
      ? `${plainDescription.slice(0, SUMMARY_DESCRIPTION_MAX).trimEnd()}…`
      : plainDescription;

  const deliveryLabel =
    deliveryMethod === "SHIP" ? t("deliveryShip") : deliveryMethod === "PICKUP" ? t("deliveryPickup") : t("deliveryBoth");

  return (
    <aside className="lg:sticky lg:top-20">
      <div className="mb-2 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("summaryTitle")}
        </h3>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {/* Thumbnail */}
        <div className="relative aspect-square w-full bg-muted">
          {firstImage ? (
            <Image src={firstImage} alt={title || "Thumbnail"} fill sizes="360px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 opacity-40" />
            </div>
          )}
          {isScheduled && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-1 text-[11px] font-medium text-white shadow">
              <Clock className="h-3 w-3" />
              {t("auctionScheduledBadge")}
            </span>
          )}
        </div>

        {/* Info */}
        <dl className="space-y-2.5 p-4">
          <Row label={t("summaryCategory")}>{t(TYPE_KEYS[auctionType])}</Row>

          <Row label={t("summaryTitleRow")} muted={!title}>
            {title || t("summaryNotFilled")}
          </Row>

          {trimmedDescription && (
            <Row label={t("summaryDescription")}>
              <span className="block leading-relaxed line-clamp-3 break-words">{trimmedDescription}</span>
            </Row>
          )}

          {auctionType === "SINGLE_CARD" && cardName && <Row label={t("cardName")}>{cardName}</Row>}
          {(auctionType === "SINGLE_CARD" || auctionType === "MULTI_CARD") && condition && (
            <Row label={t("condition")}>{condition}</Row>
          )}
          {auctionType === "SEALED_PRODUCT" && productType && (
            <Row label={t("summaryProductType")}>{productType}</Row>
          )}
          {auctionType === "OTHER" && itemCategory && (
            <Row label={t("summaryItemCategory")}>{itemCategory}</Row>
          )}

          <div className="border-t border-border pt-2.5">
            <Row label={t("startingBid")} muted={startingBid === null}>
              {startingBid !== null ? formatPrice(startingBid) : t("summaryNotFilled")}
            </Row>
            {hasReserve && reservePrice !== null && (
              <div className="mt-2.5">
                <Row label={t("reservePrice")}>{formatPrice(reservePrice)}</Row>
              </div>
            )}
            {hasBuyNow && buyNowPrice !== null && (
              <div className="mt-2.5">
                <Row label={t("buyNowPrice")}>{formatPrice(buyNowPrice)}</Row>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-2.5">
            <Row label={t("duration")}>
              {duration} {t("days")}
            </Row>
            {isScheduled && (
              <div className="mt-2.5">
                <Row label={t("summaryStartsAt")} muted>
                  {formatNLDateTime(window.startTime)}
                </Row>
              </div>
            )}
            <div className="mt-2.5">
              <Row label={t("summaryEndsAt")}>{formatNLDateTime(window.endTime)}</Row>
            </div>
          </div>

          <div className="border-t border-border pt-2.5">
            <Row label={t("summaryDelivery")}>{deliveryLabel}</Row>
            {(deliveryMethod === "PICKUP" || deliveryMethod === "BOTH") && pickupCity && (
              <div className="mt-2.5">
                <Row label={t("summaryPickupCity")}>{pickupCity}</Row>
              </div>
            )}
          </div>

          {upsellsCount > 0 && (
            <div className="border-t border-border pt-2.5">
              <Row label={t("summaryPromotions")}>
                {t("summaryPromotionsActive", { count: upsellsCount })}
              </Row>
            </div>
          )}
        </dl>
      </div>
    </aside>
  );
}
