"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { cancelPurchase, confirmDelivery } from "@/actions/purchase";
import { contactSeller } from "@/actions/message";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  ExternalLink,
  MessageCircle,
  Star,
} from "lucide-react";
import Image from "next/image";
import { OpenDisputeForm } from "./open-dispute-form";
import { SourceTypeBadge } from "@/components/ui/source-type-badge";
import { OrderDetailModal } from "./order-detail-modal";

type BundleItem = {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  imageUrl: string | null;
  reference: string | null;
  sellerNote: string | null;
};

type PurchaseBundle = {
  id: string;
  orderNumber: string;
  sellerName: string;
  sellerId: string;
  status: string;
  shippingCost: number;
  totalItemCost: number;
  totalCost: number;
  shippingMethodCarrier: string | null;
  shippingMethodService: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  createdAt: string;
  sourceType: "claimsale" | "auction" | "listing";
  sourceTitle: string | null;
  sourceImageUrl: string | null;
  items: BundleItem[];
};

const TABS = ["PAID", "SHIPPED", "COMPLETED", "CANCELLED", "DISPUTED"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, typeof Package> = {
  PAID: Package,
  SHIPPED: Truck,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  DISPUTED: AlertTriangle,
};

const TAB_COLORS: Record<Tab, string> = {
  PAID: "text-blue-600 dark:text-blue-400",
  SHIPPED: "text-purple-600 dark:text-purple-400",
  COMPLETED: "text-green-600 dark:text-green-400",
  CANCELLED: "text-red-600 dark:text-red-400",
  DISPUTED: "text-amber-600 dark:text-amber-400",
};

const STATUS_BADGE: Record<Tab, string> = {
  PAID: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  SHIPPED: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  DISPUTED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
};

const CANCEL_DAYS = 7;
const AUTO_CONFIRM_DAYS = 30;

export function PurchasesContent({ bundles }: { bundles: PurchaseBundle[] }) {
  const t = useTranslations("purchases");
  const locale = useLocale();
  const [search, setSearch] = useState("");

  const searchLower = search.toLowerCase().trim();
  const searchedBundles = searchLower
    ? bundles.filter((b) =>
        b.orderNumber.toLowerCase().includes(searchLower) ||
        b.sellerName.toLowerCase().includes(searchLower) ||
        b.totalCost.toFixed(2).includes(searchLower)
      )
    : bundles;

  const counts: Record<Tab, number> = {
    PAID: searchedBundles.filter((b) => b.status === "PAID").length,
    SHIPPED: searchedBundles.filter((b) => b.status === "SHIPPED").length,
    COMPLETED: searchedBundles.filter((b) => b.status === "COMPLETED").length,
    CANCELLED: searchedBundles.filter((b) => b.status === "CANCELLED").length,
    DISPUTED: searchedBundles.filter((b) => b.status === "DISPUTED").length,
  };

  // Hide tabs with 0 items (except always-visible ones)
  const visibleTabs = TABS.filter(
    (tab) => counts[tab] > 0 || tab === "PAID" || tab === "SHIPPED" || tab === "COMPLETED" || tab === "CANCELLED"
  );

  const defaultTab = TABS.find((tab) => counts[tab] > 0) ?? "PAID";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const filtered = searchedBundles.filter((b) => b.status === activeTab);

  return (
    <div className="mt-6 space-y-6">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-xl glass-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 overflow-x-auto">
        {visibleTabs.map((tab) => {
          const Icon = TAB_ICONS[tab];
          const isActive = activeTab === tab;
          const tabKey = `tab${tab.charAt(0) + tab.slice(1).toLowerCase()}` as
            | "tabPaid" | "tabShipped" | "tabCompleted" | "tabCancelled" | "tabDisputed";
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? TAB_COLORS[tab] : ""}`} />
              <span className="hidden sm:inline">{t(tabKey)}</span>
              {counts[tab] > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    isActive ? STATUS_BADGE[tab] : "bg-muted text-muted-foreground"
                  }`}
                >
                  {counts[tab]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bundle list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl glass-subtle p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("noPurchases")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function BundleCard({ bundle, locale }: { bundle: PurchaseBundle; locale: string }) {
  const t = useTranslations("purchases");
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showDeliveryConfirm, setShowDeliveryConfirm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const DISPUTE_OPEN_AFTER_DAYS = 10;

  const date = new Date(bundle.createdAt);
  const formattedDate = date.toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const daysSincePurchase = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  const canCancel = bundle.status === "PAID" && daysSincePurchase >= CANCEL_DAYS;
  const daysRemaining = Math.max(0, Math.ceil(CANCEL_DAYS - daysSincePurchase));

  // Auto-confirm date for SHIPPED bundles
  const autoConfirmDate = bundle.shippedAt
    ? new Date(new Date(bundle.shippedAt).getTime() + AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const autoConfirmFormatted = autoConfirmDate?.toLocaleDateString(
    locale === "nl" ? "nl-NL" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  const shippingLabel = bundle.shippingMethodCarrier
    ? `${bundle.shippingMethodCarrier} — ${bundle.shippingMethodService}`
    : t("noShippingMethod");

  async function handleCancel() {
    setCancelling(true);
    const result = await cancelPurchase(bundle.id);

    if (result?.error === "CANCEL_TOO_EARLY") {
      toast.error(t("cancelTooEarly", { days: result.daysRemaining ?? 0 }));
      setCancelling(false);
      setShowConfirm(false);
      return;
    }

    if (result?.error) {
      toast.error(t("cancelNotAllowed"));
      setCancelling(false);
      setShowConfirm(false);
      return;
    }

    toast.success(t("cancelSuccess"));
    setShowConfirm(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl glass overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <SourceTypeBadge type={bundle.sourceType} />
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                {bundle.orderNumber}
              </span>
              <Link
                href={`/verkoper/${bundle.sellerId}`}
                className="text-sm font-semibold text-foreground hover:text-primary truncate"
              >
                {bundle.sellerName}
              </Link>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_BADGE[bundle.status as Tab] ?? STATUS_BADGE.PAID
                }`}
              >
                {t(`status${bundle.status.charAt(0) + bundle.status.slice(1).toLowerCase()}` as
                  | "statusPaid" | "statusShipped" | "statusCompleted" | "statusCancelled" | "statusDisputed")}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span>{formattedDate}</span>
              {bundle.sourceType === "claimsale" ? (
                <span>{t("items", { count: bundle.items.length })}</span>
              ) : (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                  {bundle.sourceType === "auction" ? t("sourceAuction") : t("sourceListing")}
                </span>
              )}
              <span>{shippingLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-foreground">
            &euro;{bundle.totalCost.toFixed(2)}
          </span>
          <button
            onClick={() => setShowOrderDetail(true)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            {t("orderDetails")}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Order detail modal */}
      {showOrderDetail && (
        <OrderDetailModal
          namespace="purchases"
          order={{
            orderNumber: bundle.orderNumber,
            status: bundle.status,
            sourceType: bundle.sourceType,
            sourceTitle: bundle.sourceTitle,
            sourceImageUrl: bundle.sourceImageUrl,
            totalItemCost: bundle.totalItemCost,
            shippingCost: bundle.shippingCost,
            totalCost: bundle.totalCost,
            shippingMethodCarrier: bundle.shippingMethodCarrier,
            shippingMethodService: bundle.shippingMethodService,
            trackingUrl: bundle.trackingUrl,
            createdAt: bundle.createdAt,
            shippedAt: bundle.shippedAt,
            items: bundle.items,
            sellerName: bundle.sellerName,
          }}
          onClose={() => setShowOrderDetail(false)}
        />
      )}

      {/* Status hints (collapsed) */}
      {!expanded && bundle.status === "PAID" && (
        <div className="border-t border-border/50 px-4 py-2">
          {canCancel ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{t("canCancelNow")}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{t("canCancelIn", { days: daysRemaining })}</span>
            </div>
          )}
        </div>
      )}

      {!expanded && bundle.status === "SHIPPED" && (
        <div className="border-t border-border/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {bundle.trackingUrl && (
              <a
                href={bundle.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t("trackingLink")}
              </a>
            )}
            {autoConfirmFormatted && (
              <span className="text-xs text-muted-foreground">
                {t("autoConfirmWarning", { date: autoConfirmFormatted })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border/50">
          {/* Items */}
          <div className="divide-y divide-border/50">
            {bundle.items.length > 0 ? (
              bundle.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  {item.imageUrl ? (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image src={item.imageUrl} alt={item.cardName} fill className="object-cover" sizes="48px" />
                    </div>
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.cardName}</p>
                    <p className="text-xs text-muted-foreground">{item.condition}</p>
                  </div>
                  <span className="text-sm font-medium text-foreground shrink-0">
                    &euro;{item.price.toFixed(2)}
                  </span>
                </div>
              ))
            ) : bundle.sourceTitle ? (
              <div className="flex items-center gap-3 px-4 py-3">
                {bundle.sourceImageUrl ? (
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image src={bundle.sourceImageUrl} alt={bundle.sourceTitle} fill className="object-cover" sizes="48px" />
                  </div>
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{bundle.sourceTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {bundle.sourceType === "auction" ? t("sourceAuction") : t("sourceListing")}
                  </p>
                </div>
                <span className="text-sm font-medium text-foreground shrink-0">
                  &euro;{bundle.totalItemCost.toFixed(2)}
                </span>
              </div>
            ) : null}
          </div>

          {/* Cost summary */}
          <div className="border-t border-border/50 px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t("itemsCost")}</span>
              <span>&euro;{bundle.totalItemCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t("shippingCost")}</span>
              <span>&euro;{bundle.shippingCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-foreground pt-1.5 border-t border-border/50">
              <span>{t("totalCost")}</span>
              <span>&euro;{bundle.totalCost.toFixed(2)}</span>
            </div>
          </div>

          {/* Tracking link for SHIPPED */}
          {bundle.status === "SHIPPED" && bundle.trackingUrl && (
            <div className="border-t border-border/50 px-4 py-3">
              <a
                href={bundle.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {t("trackingLink")}
              </a>
            </div>
          )}

          {/* SHIPPED: confirm delivery + dispute option */}
          {bundle.status === "SHIPPED" && (
            <div className="border-t border-border/50 px-4 py-3 space-y-3">
              {autoConfirmFormatted && (
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {t("autoConfirmWarning", { date: autoConfirmFormatted })}
                </p>
              )}
              {!showDeliveryConfirm && !showDisputeForm ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowDeliveryConfirm(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t("confirmDelivery")}
                  </button>
                  {/* Dispute button: only after 10 days since shipment */}
                  {(() => {
                    const daysSinceShipped = bundle.shippedAt
                      ? (Date.now() - new Date(bundle.shippedAt).getTime()) / (1000 * 60 * 60 * 24)
                      : 0;
                    const canDispute = daysSinceShipped >= DISPUTE_OPEN_AFTER_DAYS;
                    const daysUntilDispute = Math.ceil(DISPUTE_OPEN_AFTER_DAYS - daysSinceShipped);

                    if (canDispute) {
                      return (
                        <button
                          onClick={() => setShowDisputeForm(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-400 dark:hover:bg-amber-950"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          {t("openDispute")}
                        </button>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {t("canDisputeIn", { days: daysUntilDispute })}
                      </span>
                    );
                  })()}
                </div>
              ) : showDeliveryConfirm ? (
                <DeliveryConfirmForm
                  bundleId={bundle.id}
                  sellerId={bundle.sellerId}
                  onDone={() => {
                    setShowDeliveryConfirm(false);
                    router.refresh();
                  }}
                  onCancel={() => setShowDeliveryConfirm(false)}
                />
              ) : showDisputeForm ? (
                <OpenDisputeForm
                  bundleId={bundle.id}
                  onCancel={() => setShowDisputeForm(false)}
                />
              ) : null}
            </div>
          )}

          {/* DISPUTED: show link to dispute */}
          {bundle.status === "DISPUTED" && (
            <div className="border-t border-border/50 px-4 py-3">
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
                {t("statusDisputed")}
              </p>
              <Link
                href="/dashboard/geschillen"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900"
              >
                <AlertTriangle className="h-4 w-4" />
                {t("viewDispute")}
              </Link>
            </div>
          )}

          {/* PAID: cancel/request cancel */}
          {bundle.status === "PAID" && (
            <div className="border-t border-border/50 px-4 py-3">
              {canCancel && !showConfirm && (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {t("cancelOrder")}
                </button>
              )}

              {!canCancel && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{t("canCancelIn", { days: daysRemaining })}</span>
                  </div>
                  <ContactSellerFromPurchase sellerId={bundle.sellerId} sellerName={bundle.sellerName} orderNumber={bundle.orderNumber} />
                  <p className="text-xs text-muted-foreground">{t("requestCancelHint")}</p>
                </div>
              )}

              {showConfirm && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {t("cancelConfirm", { amount: bundle.totalCost.toFixed(2) })}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {cancelling ? "..." : t("cancelConfirmButton")}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={cancelling}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
                    >
                      {t("cancelDismiss")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Escrow info for PAID/SHIPPED */}
          {(bundle.status === "PAID" || bundle.status === "SHIPPED") && (
            <div className="border-t border-border/50 px-4 py-2">
              <p className="text-xs text-muted-foreground italic">{t("escrowHeld")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Delivery confirmation form with review
function DeliveryConfirmForm({
  bundleId,
  sellerId,
  onDone,
  onCancel,
}: {
  bundleId: string;
  sellerId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("purchases");
  const [packagingRating, setPackagingRating] = useState(0);
  const [shippingRating, setShippingRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const hasReview = packagingRating > 0 && shippingRating > 0 && communicationRating > 0;

  async function handleSubmit(withReview: boolean) {
    setLoading(true);

    const review = withReview && hasReview
      ? { packagingRating, shippingRating, communicationRating, comment: comment || undefined }
      : undefined;

    const result = await confirmDelivery(bundleId, review);

    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success(t("deliveryConfirmed"));
    onDone();
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      <p className="text-sm font-medium text-foreground">{t("confirmDeliveryDescription")}</p>

      {/* Rating subcategories */}
      <div className="space-y-3">
        <RatingRow label={t("ratePackaging")} value={packagingRating} onChange={setPackagingRating} />
        <RatingRow label={t("rateShipping")} value={shippingRating} onChange={setShippingRating} />
        <RatingRow label={t("rateCommunication")} value={communicationRating} onChange={setCommunicationRating} />
      </div>

      {/* Comment */}
      <div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("reviewCommentPlaceholder")}
          rows={2}
          className="block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
        />
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-2">
        {hasReview && (
          <button
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            <Star className="h-4 w-4" />
            {loading ? "..." : t("submitReview")}
          </button>
        )}
        <button
          onClick={() => handleSubmit(false)}
          disabled={loading}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          {loading ? "..." : t("submitWithoutReview")}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          {t("cancelDismiss")}
        </button>
      </div>
    </div>
  );
}

// Contact seller button (creates/finds conversation + prefills cancel request)
function ContactSellerFromPurchase({
  sellerId,
  sellerName,
  orderNumber,
}: {
  sellerId: string;
  sellerName: string;
  orderNumber: string;
}) {
  const t = useTranslations("purchases");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleContact() {
    setLoading(true);
    const result = await contactSeller(sellerId);
    if ("error" in result) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    if (result.conversationId) {
      const message = t("cancelRequestMessage", { sellerName, orderNumber });
      router.push(`/berichten/${result.conversationId}?prefill=${encodeURIComponent(message)}`);
    }
  }

  return (
    <button
      onClick={handleContact}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {loading ? "..." : t("requestCancel")}
    </button>
  );
}

// Star rating row
function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            className="p-0.5"
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                star <= (hover || value)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
