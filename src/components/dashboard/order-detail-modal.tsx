"use client";

import { useTranslations } from "next-intl";
import { X, Printer, Package, MapPin, Check, Ban } from "lucide-react";
import { Fragment, useRef } from "react";
import Image from "next/image";
import { SourceTypeBadge } from "@/components/ui/source-type-badge";

type TimelineStep = {
  key: string;
  label: string;
  date: string | null;
  state: "complete" | "current" | "pending" | "danger";
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
      { key: "paid", label: "Betaald", date: order.createdAt, state: "complete" },
      { key: "cancelled", label: "Geannuleerd", date: null, state: "danger" },
    ];
  }

  const refundStep: TimelineStep | null = hasRefund
    ? { key: "refund", label: `Refund €${order.refundedAmount.toFixed(2)}`, date: null, state: "complete" }
    : null;

  if (isPickup) {
    const scheduledKnown = order.pickupScheduleStatus === "ACCEPTED"
      || status === "SCHEDULED" || status === "COMPLETED";
    const steps: TimelineStep[] = [
      { key: "reserved", label: "Gereserveerd", date: order.createdAt, state: "complete" },
      {
        key: "scheduled",
        label: "Afspraak",
        date: null,
        state: scheduledKnown
          ? (status === "COMPLETED" ? "complete" : "current")
          : "pending",
      },
      {
        key: "completed",
        label: "Opgehaald",
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
    { key: "paid", label: "Betaald", date: order.createdAt, state: paidComplete ? "complete" : "current" },
    {
      key: "shipped",
      label: "Verzonden",
      date: order.shippedAt,
      state: shippedComplete ? "complete" : (status === "PAID" ? "current" : "pending"),
    },
    {
      key: "delivered",
      label: "Geleverd",
      date: order.deliveredAt,
      state: deliveredComplete ? "complete" : (status === "SHIPPED" ? "current" : "pending"),
    },
  ];
  if (refundStep) steps.push(refundStep);
  return steps;
}

function OrderTimeline({ order }: { order: OrderData }) {
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
                  <p className={`text-xs font-medium ${labelClass}`}>{step.label}</p>
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
  pickupScheduleStatus: string | null;
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

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${order.orderNumber}</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:16px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
      .meta{color:#666;font-size:13px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin:8px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee;font-size:13px}
      th{font-weight:600;background:#f9f9f9}.r{text-align:right}.tot{font-weight:700;border-top:2px solid #333}
      .addr{background:#f5f5f5;padding:12px;border-radius:6px;margin:8px 0;font-size:13px}
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
          {hasAddress && (<>
            <h2>Verzendadres</h2>
            <div className="addr">
              <strong>{buyerFullName || order.buyerName}</strong><br/>
              {order.buyerStreet} {order.buyerHouseNumber}<br/>
              {order.buyerPostalCode} {order.buyerCity}<br/>
              {order.buyerCountry}
            </div>
          </>)}
          <h2>Items ({allItems.length})</h2>
          <table><thead><tr><th>#</th><th>Item</th><th>Nr.</th><th>Conditie</th>{isSeller && <th>Ref.</th>}<th className="r">Prijs</th></tr></thead>
          <tbody>{allItems.map((item, i) => (
            <tr key={i}><td>{i+1}</td><td>{item.name}</td><td>{item.reference || "—"}</td><td>{item.condition || "—"}</td>{isSeller && <td>{item.sellerNote || "—"}</td>}<td className="r">&euro;{item.price.toFixed(2)}</td></tr>
          ))}</tbody></table>
          <h2>Overzicht</h2>
          <table><tbody>
            <tr><td>Items ({allItems.length})</td><td className="r">&euro;{order.totalItemCost.toFixed(2)}</td></tr>
            <tr><td>Verzendkosten{shippingLabel && ` (${shippingLabel})`}</td><td className="r">&euro;{order.shippingCost.toFixed(2)}</td></tr>
            <tr className="tot"><td><strong>Totaal</strong></td><td className="r"><strong>&euro;{order.totalCost.toFixed(2)}</strong></td></tr>
          </tbody></table>
          {order.trackingUrl && (<><h2>Tracking</h2><p>{order.trackingUrl}</p></>)}
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
          <h3 className="text-sm font-semibold text-foreground mb-2">{t("items", { count: allItems.length })}</h3>
          <div className="divide-y divide-border/50 rounded-xl border border-border overflow-hidden">
            {allItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-3">
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
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    {item.reference && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        #{item.reference}
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
                <span className="text-sm font-medium text-foreground shrink-0">
                  &euro;{item.price.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

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
          <div className="flex justify-between text-sm font-bold text-foreground pt-1.5 border-t border-border/50">
            <span>{t("totalCost")}</span>
            <span>&euro;{order.totalCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Tracking */}
        {order.trackingUrl && (
          <div className="mt-4 rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">{t("trackingLink")}</p>
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
              {order.trackingUrl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
