"use client";

import { useTranslations } from "next-intl";
import { MapPin, Package, User, Camera } from "lucide-react";
import { ShipBundleForm } from "@/components/dashboard/ship-bundle-form";

type BuyerShippingInfoProps = {
  buyerName: string;
  bundleId: string;
  bundleStatus: string;
  address: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    country: string;
  } | null;
  shippingMethodName: string | null;
  trackingUrl: string | null;
  shippingProofUrls?: string[];
  isBriefpost?: boolean;
};

export function BuyerShippingInfo({
  buyerName,
  bundleId,
  bundleStatus,
  address,
  shippingMethodName,
  trackingUrl,
  shippingProofUrls,
  isBriefpost,
}: BuyerShippingInfoProps) {
  const t = useTranslations("sellerClaims");
  const tr = useTranslations("reputation");

  const statusColors: Record<string, string> = {
    PAID: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    SHIPPED: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  const statusLabels: Record<string, string> = {
    PAID: t("statusPaid"),
    SHIPPED: t("statusShipped"),
    COMPLETED: t("statusCompleted"),
    CANCELLED: t("statusCancelled"),
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            {tr("buyerInfo")}: {buyerName}
          </span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[bundleStatus] ?? ""}`}>
          {statusLabels[bundleStatus] ?? bundleStatus}
        </span>
      </div>

      {/* Address */}
      {address && (
        <div className="border-b border-border/50 px-5 py-3">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium text-foreground">{t("shippingAddress")}</p>
              <p className="text-muted-foreground">
                {address.street} {address.houseNumber}
              </p>
              <p className="text-muted-foreground">
                {address.postalCode} {address.city}
              </p>
              <p className="text-muted-foreground">{address.country}</p>
              {shippingMethodName && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <Package className="inline h-3 w-3 mr-1" />{shippingMethodName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tracking / Ship action */}
      {bundleStatus === "PAID" && (
        <div className="px-5 py-3">
          <ShipBundleForm bundleId={bundleId} isBriefpost={isBriefpost} />
        </div>
      )}

      {trackingUrl && bundleStatus === "SHIPPED" && (
        <div className="px-5 py-3">
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            {t("viewTracking")}
          </a>
        </div>
      )}

      {/* Shipping proof photos */}
      {shippingProofUrls && shippingProofUrls.length > 0 && (
        <div className="border-t border-border/50 px-5 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-2">
            <Camera className="h-3.5 w-3.5" />
            {t("shippingProof")}
          </p>
          <div className="flex flex-wrap gap-2">
            {shippingProofUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-lg border border-border hover:ring-2 hover:ring-primary">
                <img src={url} alt={`Verzendbewijs ${i + 1}`} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Escrow info */}
      {(bundleStatus === "PAID" || bundleStatus === "SHIPPED") && (
        <div className="border-t border-border/50 px-5 py-2">
          <p className="text-xs text-muted-foreground italic">{t("escrowInfo")}</p>
        </div>
      )}
    </div>
  );
}
