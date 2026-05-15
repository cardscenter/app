"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Image as ImageIcon, ListChecks } from "lucide-react";
import type { ListingType } from "@/types";

interface ListingFormSummaryProps {
  listingType: ListingType;
  images: string[];
  title: string;
  description: string;
  cardName: string;
  condition: string;
  conditionRange: string;
  productType: string;
  itemCategory: string;
  pricingType: "FIXED" | "NEGOTIABLE";
  price: number | null;
  suggestedPrice: number | null;
  deliveryMethod: "SHIP" | "PICKUP" | "BOTH";
  pickupCity?: string | null;
  upsellsCount: number;
  labelsCount: number;
}

const TYPE_KEYS: Record<ListingType, string> = {
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

export function ListingFormSummary({
  listingType,
  images,
  title,
  description,
  cardName,
  condition,
  conditionRange,
  productType,
  itemCategory,
  pricingType,
  price,
  suggestedPrice,
  deliveryMethod,
  pickupCity,
  upsellsCount,
  labelsCount,
}: ListingFormSummaryProps) {
  const t = useTranslations("listing");
  const firstImage = images[0];

  const plainDescription = description ? stripHtml(description) : "";
  const SUMMARY_DESCRIPTION_MAX = 120;
  const trimmedDescription =
    plainDescription.length > SUMMARY_DESCRIPTION_MAX
      ? `${plainDescription.slice(0, SUMMARY_DESCRIPTION_MAX).trimEnd()}…`
      : plainDescription;

  const deliveryLabel =
    deliveryMethod === "SHIP"
      ? t("deliveryShip")
      : deliveryMethod === "PICKUP"
        ? t("deliveryPickup")
        : t("deliveryBoth");

  const conditionLabel =
    listingType === "COLLECTION" && conditionRange ? conditionRange : condition;

  const priceLabel =
    pricingType === "NEGOTIABLE"
      ? suggestedPrice !== null
        ? `${formatPrice(suggestedPrice)} ${t("summaryPriceSuggestedHint")}`
        : t("summaryPriceNegotiable")
      : price !== null
        ? formatPrice(price)
        : t("summaryNotFilled");

  return (
    <aside className="lg:sticky lg:top-20">
      <div className="mb-2 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("summaryTitle")}
        </h3>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="relative aspect-square w-full bg-muted">
          {firstImage ? (
            <Image src={firstImage} alt={title || "Thumbnail"} fill sizes="360px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 opacity-40" />
            </div>
          )}
        </div>

        <dl className="space-y-2.5 p-4">
          <Row label={t("summaryCategory")}>{t(TYPE_KEYS[listingType])}</Row>

          <Row label={t("summaryTitleRow")} muted={!title}>
            {title || t("summaryNotFilled")}
          </Row>

          {trimmedDescription && (
            <Row label={t("summaryDescription")}>
              <span className="block leading-relaxed line-clamp-3 break-words">{trimmedDescription}</span>
            </Row>
          )}

          {listingType === "SINGLE_CARD" && cardName && <Row label={t("cardName")}>{cardName}</Row>}
          {(listingType === "SINGLE_CARD" || listingType === "MULTI_CARD") && condition && (
            <Row label={t("condition")}>{condition}</Row>
          )}
          {listingType === "COLLECTION" && conditionLabel && (
            <Row label={t("condition")}>{conditionLabel}</Row>
          )}
          {listingType === "SEALED_PRODUCT" && productType && (
            <Row label={t("summaryProductType")}>{productType}</Row>
          )}
          {listingType === "OTHER" && itemCategory && (
            <Row label={t("summaryItemCategory")}>{itemCategory}</Row>
          )}

          <div className="border-t border-border pt-2.5">
            <Row label={t("summaryPrice")} muted={price === null && suggestedPrice === null}>
              {priceLabel}
            </Row>
          </div>

          <div className="border-t border-border pt-2.5">
            <Row label={t("summaryDelivery")}>{deliveryLabel}</Row>
            {(deliveryMethod === "PICKUP" || deliveryMethod === "BOTH") && pickupCity && (
              <div className="mt-2.5">
                <Row label={t("summaryPickupCity")}>{pickupCity}</Row>
              </div>
            )}
          </div>

          {(upsellsCount > 0 || labelsCount > 0) && (
            <div className="border-t border-border pt-2.5 space-y-2.5">
              {upsellsCount > 0 && (
                <Row label={t("summaryPromotions")}>
                  {t("summaryPromotionsActive", { count: upsellsCount })}
                </Row>
              )}
              {labelsCount > 0 && (
                <Row label={t("summaryLabels")}>
                  {t("summaryLabelsActive", { count: labelsCount })}
                </Row>
              )}
            </div>
          )}
        </dl>
      </div>
    </aside>
  );
}
