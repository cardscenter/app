"use client";

import { useTranslations } from "next-intl";
import { X, Printer, Package, MapPin, Check, Ban, RotateCcw, Truck, ExternalLink, Lock, Plus } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { SourceTypeBadge } from "@/components/ui/source-type-badge";
import { SellerRefundForm } from "./seller-refund-form";
import { lockBundleForPacking } from "@/actions/purchase";

type SortKey = "default" | "name" | "condition" | "priceHigh" | "priceLow" | "reference" | "refundStatus";

const SORT_KEYS: SortKey[] = ["default", "name", "condition", "priceHigh", "priceLow", "reference", "refundStatus"];

// i18n-key suffix per SortKey ("default" → "sortDefault")
function sortI18nKey(k: SortKey): string {
  return `sort${k.charAt(0).toUpperCase()}${k.slice(1)}`;
}

// Mint-naar-Played volgorde voor sorteren op conditie. Onbekende waarden
// landen achteraan (indexOf === -1, mappen we naar Number.MAX).
const CONDITION_ORDER = [
  "Mint",
  "Near Mint",
  "Excellent",
  "Good",
  "Light Played",
  "Lightly Played",
  "Played",
  "Poor",
];

function conditionRank(c: string): number {
  const idx = CONDITION_ORDER.indexOf(c);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function applySort<T extends { name: string; condition: string; price: number; reference: string | null; refundedAt: string | null }>(
  items: T[],
  sortKey: SortKey,
): T[] {
  if (sortKey === "default") return items;
  const arr = [...items];
  switch (sortKey) {
    case "name":
      return arr.sort((a, b) => a.name.localeCompare(b.name, "nl"));
    case "condition":
      return arr.sort((a, b) => conditionRank(a.condition) - conditionRank(b.condition));
    case "priceHigh":
      return arr.sort((a, b) => b.price - a.price);
    case "priceLow":
      return arr.sort((a, b) => a.price - b.price);
    case "reference":
      return arr.sort((a, b) =>
        (a.reference ?? "").localeCompare(b.reference ?? "", "nl", { numeric: true }),
      );
    case "refundStatus":
      return arr.sort((a, b) => Number(!!a.refundedAt) - Number(!!b.refundedAt));
  }
  return arr;
}

type TimelineStepKey = "paid" | "shipped" | "delivered" | "reserved" | "scheduled" | "completed" | "cancelled" | "refund";

type TimelineStep = {
  key: TimelineStepKey;
  date: string | null;
  state: "complete" | "current" | "pending" | "danger";
  amount?: number;
};

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function buildTimelineSteps(order: OrderData): TimelineStep[] {
  const isPickup = order.deliveryMethod === "PICKUP";
  const status = order.status;
  const hasRefund = order.refundedAmount > 0;

  if (status === "CANCELLED") {
    return [
      { key: "paid", date: order.createdAt, state: "complete" },
      { key: "cancelled", date: null, state: "danger" },
    ];
  }

  const refundStep: TimelineStep | null = hasRefund
    ? { key: "refund", date: null, state: "complete", amount: order.refundedAmount }
    : null;

  if (isPickup) {
    const scheduledKnown = order.pickupScheduleStatus === "ACCEPTED"
      || status === "SCHEDULED" || status === "COMPLETED";
    const steps: TimelineStep[] = [
      { key: "reserved", date: order.createdAt, state: "complete" },
      {
        key: "scheduled",
        date: null,
        state: scheduledKnown
          ? (status === "COMPLETED" ? "complete" : "current")
          : "pending",
      },
      {
        key: "completed",
        date: order.deliveredAt,
        state: status === "COMPLETED" ? "complete" : "pending",
      },
    ];
    if (refundStep) steps.push(refundStep);
    return steps;
  }

  // SHIP-flow
  const paidComplete = status === "PAID" || status === "SHIPPED" || status === "COMPLETED" || status === "DISPUTED";
  const shippedComplete = !!order.shippedAt || status === "SHIPPED" || status === "COMPLETED" || status === "DISPUTED";
  const deliveredComplete = status === "COMPLETED";
  const steps: TimelineStep[] = [
    { key: "paid", date: order.createdAt, state: paidComplete ? "complete" : "current" },
    {
      key: "shipped",
      date: order.shippedAt,
      state: shippedComplete ? "complete" : (status === "PAID" ? "current" : "pending"),
    },
    {
      key: "delivered",
      date: order.deliveredAt,
      state: deliveredComplete ? "complete" : (status === "SHIPPED" ? "current" : "pending"),
    },
  ];
  if (refundStep) steps.push(refundStep);
  return steps;
}

function timelineLabel(step: TimelineStep, t: (k: string, vars?: Record<string, string | number>) => string): string {
  if (step.key === "refund" && step.amount !== undefined) {
    return t("orderDetail.timelineRefund", { amount: step.amount.toFixed(2) });
  }
  const map: Record<TimelineStepKey, string> = {
    paid: "orderDetail.timelinePaid",
    shipped: "orderDetail.timelineShipped",
    delivered: "orderDetail.timelineDelivered",
    reserved: "orderDetail.timelineReserved",
    scheduled: "orderDetail.timelineScheduled",
    completed: "orderDetail.timelineCompleted",
    cancelled: "orderDetail.timelineCancelled",
    refund: "orderDetail.timelineRefund",
  };
  return t(map[step.key]);
}

function OrderTimeline({ order }: { order: OrderData }) {
  const tc = useTranslations("common");
  const steps = buildTimelineSteps(order);
  return (
    <div className="mb-4 rounded-xl border border-border p-4">
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
        {steps.map((step, idx) => {
          const dotBase = "flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0";
          const dotClass = step.state === "complete"
            ? "bg-emerald-600 border-emerald-600 text-white"
            : step.state === "current"
              ? "bg-primary border-primary text-primary-foreground"
              : step.state === "danger"
                ? "bg-rose-600 border-rose-600 text-white"
                : "border-border bg-card text-muted-foreground";
          const labelClass = step.state === "pending"
            ? "text-muted-foreground"
            : step.state === "danger"
              ? "text-rose-600 dark:text-rose-400"
              : "text-foreground";
          const connectorClass = step.state === "complete"
            ? "bg-emerald-600"
            : step.state === "danger"
              ? "bg-rose-600"
              : "bg-border";
          return (
            <Fragment key={step.key}>
              <div className="flex items-center gap-2 min-w-0 shrink-0">
                <div className={`${dotBase} ${dotClass}`}>
                  {step.state === "complete" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : step.state === "danger" ? (
                    <Ban className="h-3.5 w-3.5" />
                  ) : step.state === "current" ? (
                    <span className="h-2 w-2 rounded-full bg-current" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${labelClass}`}>{timelineLabel(step, tc)}</p>
                  {step.date && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">{formatShortDate(step.date)}</p>
                  )}
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div className={`h-0.5 flex-1 min-w-[16px] ${connectorClass}`} />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

type BundleItem = {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  imageUrl: string | null;
  reference: string | null;
  sellerNote: string | null;
  refundedAt: string | null;
  quantity?: number;
  subtotal?: number;
};

type RefundEvent = {
  id: string;
  amount: number;
  createdAt: string;
  reason: string | null;
};

export type AppendEvent = {
  at: string; // ISO
  itemNames: string[];
  itemCount: number;
  itemTotal: number;
};

type OrderData = {
  bundleId: string;
  orderNumber: string;
  status: string;
  sourceType: "claimsale" | "auction" | "listing";
  sourceTitle: string | null;
  sourceImageUrl: string | null;
  totalItemCost: number;
  shippingCost: number;
  totalCost: number;
  shippingMethodCarrier: string | null;
  shippingMethodService: string | null;
  deliveryMethod: string;
  paymentMode: string;
  trackingUrl: string | null;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  refundedAmount: number;
  refundEvents: RefundEvent[];
  pickupScheduleStatus: string | null;
  lockedForPackingAt: string | null;
  appendEvents: AppendEvent[];
  items: BundleItem[];
  buyerName?: string;
  buyerFirstName?: string | null;
  buyerLastName?: string | null;
  buyerStreet?: string | null;
  buyerHouseNumber?: string | null;
  buyerPostalCode?: string | null;
  buyerCity?: string | null;
  buyerCountry?: string | null;
  sellerName?: string;
};

export function OrderDetailModal({
  order,
  onClose,
  namespace = "sales",
}: {
  order: OrderData;
  onClose: () => void;
  namespace?: "sales" | "purchases";
}) {
  const t = useTranslations(namespace);
  const tc = useTranslations("common");
  const printRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [locking, setLocking] = useState(false);

  const date = new Date(order.createdAt);
  const formattedDate = date.toLocaleDateString("nl-NL", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const buyerFullName = [order.buyerFirstName, order.buyerLastName].filter(Boolean).join(" ");
  const hasAddress = order.buyerStreet && order.buyerCity;
  const shippingLabel = order.shippingMethodCarrier
    ? `${order.shippingMethodCarrier} — ${order.shippingMethodService}`
    : null;

  const isSeller = namespace === "sales";

  const allItems: {
    id: string;
    name: string;
    condition: string;
    price: number;
    imageUrl: string | null;
    reference: string | null;
    sellerNote: string | null;
    refundedAt: string | null;
    quantity: number;
  }[] =
    order.items.length > 0
      ? order.items.map((i) => ({
          id: i.id,
          name: i.cardName,
          condition: i.condition,
          price: i.price,
          imageUrl: i.imageUrl,
          reference: i.reference,
          sellerNote: isSeller ? i.sellerNote : null,
          refundedAt: i.refundedAt,
          quantity: i.quantity ?? 1,
        }))
      : order.sourceTitle
        ? [{
            id: "source",
            name: order.sourceTitle,
            condition: "",
            price: order.totalItemCost,
            imageUrl: order.sourceImageUrl,
            reference: null,
            sellerNote: null,
            refundedAt: null,
            quantity: 1,
          }]
        : [];

  const sortedItems = applySort(allItems, sortKey);
  const sortLabel = tc(`orderDetail.${sortI18nKey(sortKey)}`);

  // Refund-eligibility: SHIPPED altijd; COMPLETED binnen 30 dagen na deliveredAt.
  // Daarbuiten is dispute-flow de juiste route. Synchroniseert met server-guard
  // in issueSellerRefund (purchase.ts COMPLETED_REFUND_WINDOW_DAYS).
  const refundEligible =
    order.status === "SHIPPED"
    || (
      order.status === "COMPLETED"
      && order.deliveredAt !== null
      && Date.now() - new Date(order.deliveredAt).getTime() <= 30 * 24 * 60 * 60 * 1000
    );

  // Refund-history per event (Fase 28). Eén Transaction-rij per refund,
  // opgehaald in de page-query op buyer-side description-prefix. Reason is
  // optioneel (uit description-suffix).
  const netTotal = Math.max(0, order.totalCost - order.refundedAmount);

  async function handleLock() {
    setLocking(true);
    const result = await lockBundleForPacking(order.bundleId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(tc("orderDetail.lockSuccess"));
      router.refresh();
    }
    setLocking(false);
  }

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${order.orderNumber}</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:16px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
      .meta{color:#666;font-size:13px;margin-bottom:16px}
      .status{background:#f5f5f5;padding:8px 12px;border-radius:6px;margin:8px 0;font-size:12px;color:#444}
      .status strong{color:#111}
      table{width:100%;border-collapse:collapse;margin:8px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee;font-size:13px}
      th{font-weight:600;background:#f9f9f9}.r{text-align:right}.tot{font-weight:700;border-top:2px solid #333}
      .addr{background:#f5f5f5;padding:12px;border-radius:6px;margin:8px 0;font-size:13px}
      .strike{text-decoration:line-through;color:#999}
      .refund{color:#047857}
      .ship{background:#fafafa;padding:10px 12px;border-left:3px solid #0ea5e9;margin:8px 0;font-size:12px;color:#444}
      .ship strong{color:#111}
      .foot{margin-top:24px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:8px}
      @media print{body{padding:0}}
    </style></head><body>${content.innerHTML}
    <div class="foot">Cards Center — ${order.orderNumber} — ${new Date().toLocaleDateString("nl-NL",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
    </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden printable content */}
        <div ref={printRef} className="hidden">
          <h1>{order.orderNumber}</h1>
          <div className="meta">
            {order.sourceType === "auction" ? "Veiling" : order.sourceType === "claimsale" ? "Claimsale" : "Marktplaats"} — {formattedDate}
            {order.buyerName && ` — Koper: ${buyerFullName || order.buyerName}`}
            {order.sellerName && ` — Verkoper: ${order.sellerName}`}
          </div>
          {/* Compact status-regel — vervangt de Cardmarket-stijl tijdlijn op papier */}
          <div className="status">
            {buildTimelineSteps(order).map((step, i, arr) => {
              const label = timelineLabel(step, tc);
              return (
                <span key={step.key}>
                  {step.state === "complete" || step.state === "current" ? (
                    <strong>{label}</strong>
                  ) : step.state === "danger" ? (
                    <span style={{ color: "#b91c1c" }}>{label}</span>
                  ) : (
                    <span style={{ color: "#999" }}>{label}</span>
                  )}
                  {step.date && ` ${formatShortDate(step.date)}`}
                  {i < arr.length - 1 && " · "}
                </span>
              );
            })}
          </div>
          {hasAddress && (<>
            <h2>Verzendadres</h2>
            <div className="addr">
              <strong>{buyerFullName || order.buyerName}</strong><br/>
              {order.buyerStreet} {order.buyerHouseNumber}<br/>
              {order.buyerPostalCode} {order.buyerCity}<br/>
              {order.buyerCountry}
            </div>
          </>)}
          {order.deliveryMethod !== "PICKUP" && order.shippedAt && (
            <div className="ship">
              {shippingLabel && <><strong>{shippingLabel}</strong><br/></>}
              Verzonden op {new Date(order.shippedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
              {order.trackingUrl && <><br/>Track-and-trace: {order.trackingUrl}</>}
            </div>
          )}
          <h2>Items ({sortedItems.length}) — gesorteerd op: {sortLabel}</h2>
          <table><thead><tr><th>#</th><th>Aantal</th><th>Item</th><th>Nr.</th><th>Conditie</th>{isSeller && <th>Notitie</th>}<th className="r">Prijs</th></tr></thead>
          <tbody>{sortedItems.map((item, i) => {
            const refunded = !!item.refundedAt;
            const lineCls = refunded ? "strike" : "";
            return (
              <tr key={item.id}>
                <td className={lineCls}>{i+1}</td>
                <td className={lineCls}>{item.quantity > 1 ? `${item.quantity}×` : "1×"}</td>
                <td className={lineCls}>{item.name}{refunded ? " (refund)" : ""}</td>
                <td className={lineCls}>{item.reference || "—"}</td>
                <td className={lineCls}>{item.condition || "—"}</td>
                {isSeller && <td className={lineCls}>{item.sellerNote || "—"}</td>}
                <td className={`r ${lineCls}`}>&euro;{(item.quantity > 1 ? item.price * item.quantity : item.price).toFixed(2)}</td>
              </tr>
            );
          })}</tbody></table>
          <h2>Overzicht</h2>
          <table><tbody>
            <tr><td>Items ({sortedItems.length})</td><td className="r">&euro;{order.totalItemCost.toFixed(2)}</td></tr>
            <tr><td>Verzendkosten{shippingLabel && ` (${shippingLabel})`}</td><td className="r">&euro;{order.shippingCost.toFixed(2)}</td></tr>
            {order.refundedAmount > 0 && (
              <tr className="refund"><td>Refund</td><td className="r">−&euro;{order.refundedAmount.toFixed(2)}</td></tr>
            )}
            <tr className="tot">
              <td><strong>Totaal</strong></td>
              <td className="r">
                {order.refundedAmount > 0 ? (
                  <><span className="strike">&euro;{order.totalCost.toFixed(2)}</span> <strong>&euro;{netTotal.toFixed(2)}</strong></>
                ) : (
                  <strong>&euro;{order.totalCost.toFixed(2)}</strong>
                )}
              </td>
            </tr>
          </tbody></table>
          {order.refundedAmount > 0 && (<>
            <h2>Refund-historie</h2>
            <table><tbody>
              {order.refundEvents.length > 0 ? (
                order.refundEvents.map((ev) => (
                  <tr key={ev.id} className="refund">
                    <td>{formatShortDate(ev.createdAt)}</td>
                    <td>{ev.reason || "—"}</td>
                    <td className="r">−&euro;{ev.amount.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr className="refund"><td colSpan={2}>Refund op bundle</td><td className="r">−&euro;{order.refundedAmount.toFixed(2)}</td></tr>
              )}
              <tr className="tot refund"><td colSpan={2}><strong>Totaal terugbetaald</strong></td><td className="r"><strong>&euro;{order.refundedAmount.toFixed(2)}</strong></td></tr>
            </tbody></table>
          </>)}
        </div>

        {/* Visual header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SourceTypeBadge type={order.sourceType} namespace={namespace} />
              <h2 className="text-lg font-bold text-foreground">{order.orderNumber}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              <Printer className="h-4 w-4" />
              {tc("print")}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Status timeline */}
        <OrderTimeline order={order} />

        {/* Inpak-lock + append-history (claimsale-merge). Alleen op claimsale-
            bundles, alleen voor seller, alleen wanneer relevant. */}
        {isSeller && order.sourceType === "claimsale" && (
          <>
            {order.status === "PAID" && !order.lockedForPackingAt && (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-700/40 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      {tc("orderDetail.lockTitle")}
                    </p>
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                      {tc("orderDetail.lockDescription")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLock}
                  disabled={locking}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-700 dark:hover:bg-amber-600"
                >
                  <Lock className="h-3.5 w-3.5" />
                  {tc("orderDetail.lockButton")}
                </button>
              </div>
            )}
            {order.lockedForPackingAt && order.status === "PAID" && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-300/60 bg-slate-50 p-3 text-sm dark:border-slate-700/60 dark:bg-slate-900/40">
                <Lock className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />
                <span className="text-slate-700 dark:text-slate-200">
                  {tc("orderDetail.lockedAt", { date: new Date(order.lockedForPackingAt).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}
                </span>
              </div>
            )}
            {order.appendEvents.length > 0 && (
              <div className="mb-4 rounded-xl border border-border bg-card p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Plus className="h-4 w-4 text-primary" />
                  {tc("orderDetail.appendHistoryTitle")}
                </p>
                <ul className="space-y-2">
                  {order.appendEvents.map((ev, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 inline-flex shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        {new Date(ev.at).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {tc("orderDetail.appendEntry", { count: ev.itemCount, total: ev.itemTotal.toFixed(2) })}
                        </span>
                        {ev.itemNames.length > 0 && (
                          <span className="ml-1">— {ev.itemNames.slice(0, 4).join(", ")}{ev.itemNames.length > 4 ? ` +${ev.itemNames.length - 4}` : ""}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Shipping address (seller view) */}
        {hasAddress && (
          <div className="mb-4 rounded-xl border border-border p-4">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t("shippingAddress")}</p>
                {buyerFullName && <p className="text-sm font-semibold text-foreground">{buyerFullName}</p>}
                <p className="text-sm text-foreground">{order.buyerStreet} {order.buyerHouseNumber}</p>
                <p className="text-sm text-foreground">{order.buyerPostalCode} {order.buyerCity}</p>
                {order.buyerCountry && <p className="text-sm text-muted-foreground">{order.buyerCountry}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Seller info (buyer view) */}
        {order.sellerName && !hasAddress && (
          <div className="mb-4 rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">{t("sourceAuction") === "Veiling" ? "Verkoper" : "Seller"}</p>
            <p className="text-sm font-semibold text-foreground">{order.sellerName}</p>
          </div>
        )}

        {/* Items list */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="text-sm font-semibold text-foreground">{t("items", { count: sortedItems.length })}</h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">{tc("orderDetail.sortBy")}</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>{tc(`orderDetail.${sortI18nKey(key)}`)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="divide-y divide-border/50 rounded-xl border border-border overflow-hidden">
            {sortedItems.map((item, idx) => {
              const isRefunded = !!item.refundedAt;
              return (
                <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${isRefunded ? "opacity-60" : ""}`}>
                  <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                  {item.imageUrl ? (
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="40px" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.quantity > 1 && (
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{item.quantity}×</span>
                      )}
                      <p className={`text-sm font-medium truncate ${isRefunded ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {item.name}
                      </p>
                      {item.reference && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                          #{item.reference}
                        </span>
                      )}
                      {isRefunded && (
                        <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          {tc("orderDetail.refundBadge")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.condition && <p className="text-xs text-muted-foreground">{item.condition}</p>}
                      {item.sellerNote && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">{item.sellerNote}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm font-medium shrink-0 ${isRefunded ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    &euro;{(item.quantity > 1 ? item.price * item.quantity : item.price).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inline refund-actie — SHIPPED altijd, COMPLETED binnen 30d na delivery */}
        {isSeller && refundEligible && (
          <div className="mb-4">
            <SellerRefundForm
              bundleId={order.bundleId}
              buyerName={buyerFullName || order.buyerName || "—"}
              totalCost={order.totalCost}
              refundedAmount={order.refundedAmount}
            />
          </div>
        )}

        {/* Totals */}
        <div className="rounded-xl border border-border p-4 space-y-1.5">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("itemsCost")}</span>
            <span>&euro;{order.totalItemCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("shippingCost")}{shippingLabel && ` (${shippingLabel})`}</span>
            <span>&euro;{order.shippingCost.toFixed(2)}</span>
          </div>
          {order.refundedAmount > 0 && (
            <div className="flex justify-between text-sm text-emerald-700 dark:text-emerald-400">
              <span>{tc("orderDetail.refundRow")}</span>
              <span>−&euro;{order.refundedAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline gap-3 pt-1.5 border-t border-border/50">
            <span className="text-sm font-bold text-foreground">{t("totalCost")}</span>
            {order.refundedAmount > 0 ? (
              <span className="flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground line-through">&euro;{order.totalCost.toFixed(2)}</span>
                <span className="text-sm font-bold text-foreground">&euro;{netTotal.toFixed(2)}</span>
              </span>
            ) : (
              <span className="text-sm font-bold text-foreground">&euro;{order.totalCost.toFixed(2)}</span>
            )}
          </div>
        </div>

        {/* Refund-historie (zichtbaar voor beide partijen) — één regel per refund-event */}
        {order.refundedAmount > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              {tc("orderDetail.refundHistoryTitle")}
            </h3>
            <div className="space-y-2">
              {order.refundEvents.length > 0 ? (
                order.refundEvents.map((ev) => (
                  <div key={ev.id} className="flex justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="text-muted-foreground tabular-nums">
                        {formatShortDate(ev.createdAt)}
                      </span>
                      {ev.reason && (
                        <span className="ml-2 text-foreground italic">&ldquo;{ev.reason}&rdquo;</span>
                      )}
                    </div>
                    <span className="text-emerald-700 dark:text-emerald-400 shrink-0 tabular-nums">
                      −&euro;{ev.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                // Fallback voor pre-Fase-28 refunds zonder Transaction-event
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{tc("orderDetail.refundBundle")}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    −&euro;{order.refundedAmount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/50 flex justify-between text-sm font-semibold">
              <span className="text-foreground">{tc("orderDetail.refundTotal")}</span>
              <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                &euro;{order.refundedAmount.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Verzending — alleen voor SHIP-bundles die verzonden zijn */}
        {order.deliveryMethod !== "PICKUP" && order.shippedAt && (
          <div className="mt-4 rounded-xl border border-border p-4">
            <div className="flex items-start gap-2">
              <Truck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">{tc("orderDetail.shippingTitle")}</p>
                {shippingLabel && (
                  <p className="text-sm font-semibold text-foreground">{shippingLabel}</p>
                )}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {tc("orderDetail.shippedOn", {
                    date: new Date(order.shippedAt).toLocaleDateString("nl-NL", {
                      day: "numeric", month: "long", year: "numeric",
                    }),
                  })}
                </p>
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-sm text-primary hover:underline break-all"
                  >
                    {t("trackingLink")}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
