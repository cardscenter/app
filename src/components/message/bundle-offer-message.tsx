"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Package, Check, X, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  respondToBundleOffer,
  withdrawBundleOffer,
  completeBundleOfferPayment,
  counterBundleOffer,
} from "@/actions/bundle-offer";
import { PickupActions, type PickupScheduleData } from "@/components/message/pickup-actions";

interface SellerShippingMethodLite {
  id: string;
  carrier: string;
  serviceName: string;
  price: number;
  isSigned: boolean;
  shippingType: string;
}

interface BundleListingThumb {
  listingId: string;
  title: string;
  imageUrl: string | null;
  priceSnapshot: number | null;
  // Fase 27.66: aantal stuks (stocked) of geselecteerde items (multi-partial).
  quantity?: number;
  itemCount?: number; // afgeleid uit itemIds.length voor MULTI_CARD partial
}

export interface BundleProposalData {
  id: string;
  buyerId: string;
  sellerId: string;
  totalAmount: number;
  deliveryMethod: string;
  paymentMode: string;
  requestInsuredShipping: boolean;
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
  // Voor seller-accept-modal (alleen relevant als currentUser=seller).
  sellerShippingMethods?: SellerShippingMethodLite[];
}

export function BundleOfferMessage({ bundleProposal: bp, currentUserId, isOwn, sellerShippingMethods = [] }: Props) {
  const t = useTranslations("bundleOffer");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [selectedShippingId, setSelectedShippingId] = useState<string>("");
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterAmount, setCounterAmount] = useState<string>("");

  const isBuyer = bp.buyerId === currentUserId;
  const isSeller = bp.sellerId === currentUserId;
  const canSellerRespond = isSeller && bp.status === "PENDING";
  const canBuyerWithdraw = isBuyer && bp.status === "PENDING";
  const canBuyerCompletePayment =
    isBuyer && bp.status === "ACCEPTED" && bp.paymentStatus === "AWAITING_PAYMENT";
  // Tegenbod doen (Fase 27.70): de NIET-proposer kan een ander bedrag voorstellen.
  // Tegenpartij = wie het bericht NIET heeft gestuurd. We bepalen dat via isOwn:
  // als het voorstel van mij is (isOwn) mag ik niet zelf counter-bidden.
  const canCounter = !isOwn && bp.status === "PENDING";

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

        {/* Listings preview — toont aantal voor stocked of items voor partial */}
        <ul className="mb-3 space-y-1.5">
          {bp.listings.map((l) => {
            const qtyLabel = l.itemCount && l.itemCount > 0
              ? ` (${l.itemCount} items)`
              : l.quantity && l.quantity > 1
                ? ` (${l.quantity}×)`
                : "";
            return (
              <li key={l.listingId} className="flex items-center gap-2 text-sm text-foreground">
                <span className="inline-block size-2 rounded-full bg-muted-foreground/40" />
                <span className="truncate">{l.title}{qtyLabel}</span>
                {l.priceSnapshot !== null && (
                  <span className="ml-auto text-xs text-muted-foreground">€{l.priceSnapshot.toFixed(2)}</span>
                )}
              </li>
            );
          })}
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
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (bp.deliveryMethod === "SHIP") setShowAcceptModal(true);
                  else run(() => respondToBundleOffer(bp.id, "ACCEPT"));
                }}
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
          </div>
        )}

        {/* Tegenbod-knop — voor de NIET-proposer bij PENDING. Werkt zowel
            voor buyer (counter op seller's eerdere counter) als seller
            (counter op buyer's origineel). */}
        {canCounter && (
          <button
            onClick={() => {
              setCounterAmount(bp.totalAmount.toFixed(2));
              setShowCounterModal(true);
            }}
            disabled={loading}
            className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {t("counter")}
          </button>
        )}

        {/* Counter-modal */}
        {showCounterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCounterModal(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl border border-border" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 text-base font-semibold text-foreground">{t("counterTitle")}</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("counterHint", { current: bp.totalAmount.toFixed(2) })}
              </p>
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCounterModal(false)}
                  className="flex-1 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() => {
                    const amount = parseFloat(counterAmount);
                    if (!amount || amount <= 0) {
                      setError(t("errors.invalidAmount"));
                      return;
                    }
                    setShowCounterModal(false);
                    run(() => counterBundleOffer({ parentProposalId: bp.id, totalAmount: amount }));
                  }}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {t("submitCounter")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Seller-accept modal voor SHIP-bundles: kies verzendmethode */}
        {showAcceptModal && (() => {
          const usable = sellerShippingMethods.filter((sm) => sm.shippingType !== "LETTER");
          const insuredRequired = bp.requestInsuredShipping || bp.totalAmount > 150;
          const visible = insuredRequired ? usable.filter((sm) => sm.isSigned) : usable;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAcceptModal(false)}>
              <div className="glass w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{t("acceptShipping.title")}</h3>
                  <button onClick={() => setShowAcceptModal(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">{t("acceptShipping.hint")}</p>
                {insuredRequired && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t("acceptShipping.insuredBadge")}
                  </div>
                )}
                {visible.length === 0 ? (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    {t("acceptShipping.noMethods")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visible.map((sm) => (
                      <label
                        key={sm.id}
                        className={`flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer transition-colors ${
                          selectedShippingId === sm.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipMethod"
                          checked={selectedShippingId === sm.id}
                          onChange={() => setSelectedShippingId(sm.id)}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-foreground">
                            {sm.carrier} {sm.serviceName}
                          </div>
                          <div className="text-xs text-muted-foreground">€{sm.price.toFixed(2)}{sm.isSigned ? " · aangetekend" : ""}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setShowAcceptModal(false)}
                    disabled={loading}
                    className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedShippingId) return;
                      setLoading(true);
                      setError(null);
                      const result = await respondToBundleOffer(bp.id, "ACCEPT", selectedShippingId);
                      if (result?.error) setError(result.error);
                      else {
                        setShowAcceptModal(false);
                        router.refresh();
                      }
                      setLoading(false);
                    }}
                    disabled={loading || !selectedShippingId || visible.length === 0}
                    className="flex-1 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {t("acceptShipping.confirm")}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
