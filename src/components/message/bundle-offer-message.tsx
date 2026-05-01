"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Package, Check, X, Clock, AlertTriangle } from "lucide-react";
import {
  respondToBundleOffer,
  withdrawBundleOffer,
  completeBundleOfferPayment,
} from "@/actions/bundle-offer";
import { PickupActions, type PickupScheduleData } from "@/components/message/pickup-actions";

interface BundleListingThumb {
  listingId: string;
  title: string;
  imageUrl: string | null;
  priceSnapshot: number | null;
}

export interface BundleProposalData {
  id: string;
  buyerId: string;
  sellerId: string;
  totalAmount: number;
  deliveryMethod: string;
  paymentMode: string;
  status: string;
  paymentStatus: string | null;
  paymentDeadline: string | null;
  pickupReservationExpiresAt: string | null;
  expiresAt: string | null;
  listings: BundleListingThumb[];
  // Optional — alleen voor ACCEPTED bundles met een gekoppelde ShippingBundle.
  shippingBundleId?: string | null;
  bundleStatus?: string | null;
  pickupSchedule?: PickupScheduleData | null;
}

interface Props {
  bundleProposal: BundleProposalData;
  currentUserId: string;
  isOwn: boolean;
}

export function BundleOfferMessage({ bundleProposal: bp, currentUserId, isOwn }: Props) {
  const t = useTranslations("bundleOffer");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBuyer = bp.buyerId === currentUserId;
  const isSeller = bp.sellerId === currentUserId;
  const canSellerRespond = isSeller && bp.status === "PENDING";
  const canBuyerWithdraw = isBuyer && bp.status === "PENDING";
  const canBuyerCompletePayment =
    isBuyer && bp.status === "ACCEPTED" && bp.paymentStatus === "AWAITING_PAYMENT";

  async function run(fn: () => Promise<{ error?: string; success?: boolean }>) {
    setLoading(true);
    setError(null);
    const result = await fn();
    if (result.error) setError(result.error);
    else router.refresh();
    setLoading(false);
  }

  const remainingPaymentDays = bp.paymentDeadline
    ? Math.max(0, Math.ceil((new Date(bp.paymentDeadline).getTime() - Date.now()) / (86400_000)))
    : null;
  const remainingPickupDays = bp.pickupReservationExpiresAt
    ? Math.max(0, Math.ceil((new Date(bp.pickupReservationExpiresAt).getTime() - Date.now()) / (86400_000)))
    : null;

  const statusColor =
    bp.status === "ACCEPTED" ? "text-green-600 dark:text-green-400" :
    bp.status === "REJECTED" || bp.status === "WITHDRAWN" || bp.status === "EXPIRED" ? "text-red-500" :
    "text-yellow-600 dark:text-yellow-400";

  const statusIcon =
    bp.status === "ACCEPTED" ? <Check className="h-4 w-4" /> :
    bp.status === "REJECTED" || bp.status === "WITHDRAWN" || bp.status === "EXPIRED" ? <X className="h-4 w-4" /> :
    <Clock className="h-4 w-4" />;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {t("messageBubble.title", { count: bp.listings.length })}
          </span>
        </div>

        {/* Listings preview */}
        <ul className="mb-3 space-y-1.5">
          {bp.listings.map((l) => (
            <li key={l.listingId} className="flex items-center gap-2 text-sm text-foreground">
              <span className="inline-block size-2 rounded-full bg-muted-foreground/40" />
              <span className="truncate">{l.title}</span>
              {l.priceSnapshot !== null && (
                <span className="ml-auto text-xs text-muted-foreground">€{l.priceSnapshot.toFixed(2)}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="text-2xl font-bold text-foreground mb-1">
          €{bp.totalAmount.toFixed(2)}
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          {bp.deliveryMethod === "PICKUP" ? t("pickupOption") : t("shippingOption")}
        </div>

        <div className={`flex items-center gap-1.5 text-sm font-medium mb-2 ${statusColor}`}>
          {statusIcon}
          {t(`status.${bp.status.toLowerCase()}`)}
        </div>

        {bp.paymentStatus === "AWAITING_PAYMENT" && remainingPaymentDays !== null && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
            {t("paymentDeadline.ship", { days: remainingPaymentDays.toString() })}
          </p>
        )}
        {bp.paymentStatus === "EXTERNAL" && remainingPickupDays !== null && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
            {t("paymentDeadline.pickup", { days: remainingPickupDays.toString() })}
          </p>
        )}
        {bp.paymentStatus === "PAID" && (
          <p className="text-xs text-green-600 dark:text-green-400 mb-2">{t("paymentComplete")}</p>
        )}
        {bp.paymentStatus === "PAYMENT_FAILED" && (
          <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("paymentFailed")}
          </p>
        )}

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        {canSellerRespond && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => run(() => respondToBundleOffer(bp.id, "ACCEPT"))}
              disabled={loading}
              className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {t("accept")}
            </button>
            <button
              onClick={() => run(() => respondToBundleOffer(bp.id, "REJECT"))}
              disabled={loading}
              className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {t("reject")}
            </button>
          </div>
        )}

        {canBuyerWithdraw && (
          <button
            onClick={() => run(() => withdrawBundleOffer(bp.id))}
            disabled={loading}
            className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {t("withdraw")}
          </button>
        )}

        {canBuyerCompletePayment && (
          <button
            onClick={() => run(() => completeBundleOfferPayment(bp.id))}
            disabled={loading}
            className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {t("completePayment")}
          </button>
        )}

        {/* Pickup-flow embed (Fase 27) — alleen bij ACCEPTED bundle met gekoppelde
            ShippingBundle, en alleen voor PICKUP-bundles. */}
        {bp.shippingBundleId && bp.bundleStatus && bp.deliveryMethod === "PICKUP" && bp.status === "ACCEPTED" && (
          <PickupActions
            shippingBundleId={bp.shippingBundleId}
            bundleStatus={bp.bundleStatus}
            paymentMode={bp.paymentMode}
            schedule={bp.pickupSchedule ?? null}
            currentUserId={currentUserId}
            buyerId={bp.buyerId}
            sellerId={bp.sellerId}
          />
        )}
      </div>
    </div>
  );
}
