"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { confirmDelivery } from "@/actions/purchase";
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
  CreditCard,
} from "lucide-react";
import Image from "next/image";
import { OpenDisputeForm } from "./open-dispute-form";
import { SourceTypeBadge } from "@/components/ui/source-type-badge";
import { OrderDetailModal } from "./order-detail-modal";
import { PendingAuctionPayments } from "./pending-auction-payments";
import { CancellationActions } from "./cancellation-actions";

type BundleItem = {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  imageUrl: string | null;
  reference: string | null;
  sellerNote: string | null;
  refundedAt: string | null;
  // Fase 27.29: gegroepeerde rijen — 5× dezelfde booster wordt één rij met
  // quantity=5 + subtotal=5×price. Voor unieke regels blijft quantity=1
  // en subtotal=price.
  quantity?: number;
  subtotal?: number;
};

type RefundEvent = {
  id: string;
  amount: number;
  createdAt: string;
  reason: string | null;
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
  deliveryMethod: string;
  paymentMode: string;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  refundedAmount: number;
  refundEvents: RefundEvent[];
  pickupScheduleStatus: string | null;
  createdAt: string;
  sourceType: "claimsale" | "auction" | "listing";
  sourceTitle: string | null;
  sourceImageUrl: string | null;
  items: BundleItem[];
};

// PENDING is een virtuele tab — toont auction-pending-payments i.p.v.
// bundle-statussen. Alleen zichtbaar als er openstaande betalingen zijn.
const TABS = ["PENDING", "PAID", "SHIPPED", "COMPLETED", "CANCELLED", "DISPUTED"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, typeof Package> = {
  PENDING: CreditCard,
  PAID: Package,
  SHIPPED: Truck,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  DISPUTED: AlertTriangle,
};

const TAB_COLORS: Record<Tab, string> = {
  PENDING: "text-orange-600 dark:text-orange-400",
  PAID: "text-blue-600 dark:text-blue-400",
  SHIPPED: "text-purple-600 dark:text-purple-400",
  COMPLETED: "text-green-600 dark:text-green-400",
  CANCELLED: "text-red-600 dark:text-red-400",
  DISPUTED: "text-amber-600 dark:text-amber-400",
};

const STATUS_BADGE: Record<Tab, string> = {
  PENDING: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  PAID: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  SHIPPED: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  DISPUTED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
};

const AUTO_CONFIRM_DAYS = 30;

type PendingAuctionPayment = {
  id: string;
  title: string;
  finalPrice: number | null;
  paymentDeadline: Date | string | null;
};

interface PurchasesContentProps {
  bundles: PurchaseBundle[];
  pendingAuctionPayments?: PendingAuctionPayment[];
  /** Voor PendingAuctionPayments component — laat de breakdown 'beschikbaar/tekort' zien. */
  availableBalance?: number;
  reservedBalance?: number;
  /** Huidige user-id — doorgegeven aan CancellationActions zodat die weet wie proposer/responder is. */
  currentUserId: string;
}

export function PurchasesContent({
  bundles,
  pendingAuctionPayments = [],
  availableBalance = 0,
  reservedBalance = 0,
  currentUserId,
}: PurchasesContentProps) {
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
    PENDING: pendingAuctionPayments.length,
    PAID: searchedBundles.filter((b) => b.status === "PAID").length,
    SHIPPED: searchedBundles.filter((b) => b.status === "SHIPPED").length,
    COMPLETED: searchedBundles.filter((b) => b.status === "COMPLETED").length,
    CANCELLED: searchedBundles.filter((b) => b.status === "CANCELLED").length,
    DISPUTED: searchedBundles.filter((b) => b.status === "DISPUTED").length,
  };

  // Hide tabs with 0 items (except always-visible ones). PENDING is alleen
  // zichtbaar als er daadwerkelijk auction-pending-payments zijn.
  const visibleTabs = TABS.filter(
    (tab) =>
      counts[tab] > 0 ||
      tab === "PAID" || tab === "SHIPPED" || tab === "COMPLETED" || tab === "CANCELLED"
  );

  // Default-tab: PENDING heeft voorrang (urgentste actie), anders eerste tab
  // met items, anders PAID als fallback.
  const defaultTab = counts.PENDING > 0
    ? "PENDING" as Tab
    : (TABS.find((tab) => tab !== "PENDING" && counts[tab] > 0) ?? "PAID");
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  // Safety-net: als de huidige activeTab niet meer in visibleTabs zit (bv. na
  // payment verdwijnt PENDING uit visibleTabs), schakel automatisch naar de
  // eerste zichtbare tab. Voorkomt een lege body met "geen tab actief".
  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? "PAID");
    }
  }, [visibleTabs, activeTab]);

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
            | "tabPending" | "tabPaid" | "tabShipped" | "tabCompleted" | "tabCancelled" | "tabDisputed";
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

      {/* Tab body — PENDING toont auction-pending-payments component, andere
          tabs tonen de filtered bundle-list. */}
      {activeTab === "PENDING" ? (
        pendingAuctionPayments.length === 0 ? (
          <div className="rounded-xl glass-subtle p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("noPurchases")}</p>
          </div>
        ) : (
          <PendingAuctionPayments
            auctions={pendingAuctionPayments.map((a) => ({
              id: a.id,
              title: a.title,
              finalPrice: a.finalPrice,
              paymentDeadline: a.paymentDeadline ? new Date(a.paymentDeadline) : null,
            }))}
            availableBalance={availableBalance}
            reservedBalance={reservedBalance}
            onPaymentComplete={() => setActiveTab("PAID")}
          />
        )
      ) : filtered.length === 0 ? (
        <div className="rounded-xl glass-subtle p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("noPurchases")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} locale={locale} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}

function BundleCard({ bundle, locale, currentUserId }: { bundle: PurchaseBundle; locale: string; currentUserId: string }) {
  const t = useTranslations("purchases");
  const [expanded, setExpanded] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showDeliveryConfirm, setShowDeliveryConfirm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const DISPUTE_OPEN_AFTER_DAYS = 10;

  const date = new Date(bundle.createdAt);
  const formattedDate = date.toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  // Auto-confirm date for SHIPPED bundles
  const autoConfirmDate = bundle.shippedAt
    ? new Date(new Date(bundle.shippedAt).getTime() + AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const autoConfirmFormatted = autoConfirmDate?.toLocaleDateString(
    locale === "nl" ? "nl-NL" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  const shippingLabel = bundle.deliveryMethod === "PICKUP"
    ? t("pickupLabel")
    : bundle.shippingMethodCarrier
      ? `${bundle.shippingMethodCarrier} — ${bundle.shippingMethodService}`
      : t("noShippingMethod");

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
          {bundle.refundedAmount > 0 ? (
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[11px] text-muted-foreground line-through tabular-nums">
                &euro;{bundle.totalCost.toFixed(2)}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-foreground tabular-nums">
                  &euro;{(bundle.totalCost - bundle.refundedAmount).toFixed(2)}
                </span>
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 tabular-nums dark:bg-emerald-950 dark:text-emerald-400">
                  &minus;&euro;{bundle.refundedAmount.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-sm font-bold text-foreground tabular-nums">
              &euro;{bundle.totalCost.toFixed(2)}
            </span>
          )}
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
            bundleId: bundle.id,
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
            deliveryMethod: bundle.deliveryMethod,
            paymentMode: bundle.paymentMode,
            trackingUrl: bundle.trackingUrl,
            createdAt: bundle.createdAt,
            shippedAt: bundle.shippedAt,
            deliveredAt: bundle.deliveredAt,
            refundedAmount: bundle.refundedAmount,
            refundEvents: bundle.refundEvents,
            pickupScheduleStatus: bundle.pickupScheduleStatus,
            items: bundle.items,
            sellerName: bundle.sellerName,
          }}
          onClose={() => setShowOrderDetail(false)}
        />
      )}

      {/* Status hints (collapsed) */}
      {!expanded && bundle.status === "PAID" && (
        <div className="border-t border-border/50 px-4 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{t("waitingForShipment")}</span>
          </div>
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
              bundle.items.map((item) => {
                const qty = item.quantity ?? 1;
                const subtotal = item.subtotal ?? item.price;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {item.imageUrl ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <Image src={item.imageUrl} alt={item.cardName} fill className="object-cover" sizes="48px" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {qty > 1 && <span className="text-muted-foreground">{qty}× </span>}
                        {item.cardName}
                      </p>
                      {item.condition && (
                        <p className="text-xs text-muted-foreground">{item.condition}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-foreground tabular-nums">
                        &euro;{subtotal.toFixed(2)}
                      </p>
                      {qty > 1 && (
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {qty} × &euro;{item.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
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

          {/* PAID: annulering aanvragen via mutual-akkoord-flow (verkoper moet akkoord geven) */}
          {bundle.status === "PAID" && (
            <div className="border-t border-border/50 px-4 py-3 space-y-2">
              <ContactSellerFromPurchase sellerId={bundle.sellerId} sellerName={bundle.sellerName} orderNumber={bundle.orderNumber} />
              <CancellationActions
                bundleId={bundle.id}
                currentUserId={currentUserId}
                bundleStatus={bundle.status}
              />
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
