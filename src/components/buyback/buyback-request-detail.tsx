"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { BuybackStatusBadge } from "./buyback-status-badge";
import { TrackingForm } from "./tracking-form";
import { PriceCorrectionPrompt } from "./price-correction-prompt";
import { BuybackOutcomeInfo, BuybackFAQ } from "./buyback-outcome-info";
import { cancelBuybackRequest } from "@/actions/buyback";
import { CheckCircle2, XCircle, Clock, Banknote, Package, ExternalLink, Truck } from "lucide-react";
import type { BuybackRequest, BuybackItem, BulkBuybackItem } from "@prisma/client";
import { BuybackDecision } from "./buyback-decision";
import { buttonVariants } from "@/components/ui/button-variants";
import { TABLE_HEAD, TABLE_CELL } from "@/components/ploy/tile-styles";
import { TONE_ICON, TONE_SURFACE } from "@/components/dashboard/ui/tones";
import { cn } from "@/lib/utils";

type RequestWithItems = Omit<BuybackRequest, "iban"> & {
  /** Gemaskeerd door de page (Fase 6: het IBAN staat versleuteld in de DB). */
  iban: string | null;
  items: BuybackItem[];
  bulkItems: BulkBuybackItem[];
  returnPayment: { status: string; checkoutUrl: string | null } | null;
};

const ITEM_STATUS_ICON: Record<string, typeof CheckCircle2> = {
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  PENDING: Clock,
};

const ITEM_STATUS_COLOR: Record<string, string> = {
  APPROVED: "text-[var(--pastel-green-ink)]",
  REJECTED: "text-[var(--destructive)]",
  PENDING: "text-foreground/40",
};

export function BuybackRequestDetail({ request, categoryLabels = {} }: { request: RequestWithItems; categoryLabels?: Record<string, string> }) {
  const t = useTranslations("buyback");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCancel, setShowCancel] = useState(false);

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelBuybackRequest(request.id);
      if (result?.success) {
        toast.success("Aanvraag geannuleerd");
        router.refresh();
      } else {
        toast.error(result?.error ?? "Er ging iets mis");
      }
    });
  }

  const canCancel = request.status === "PENDING";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="cc-display text-[32px] text-foreground lg:text-[40px]">{t("requestDetail")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {request.type === "COLLECTION" ? t("typeCollection") : t("typeBulk")} · {" "}
            {new Date(request.createdAt).toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <BuybackStatusBadge status={request.status} />
      </div>

      {/* Status-bewuste outcome-info — beantwoordt voor elke fase wat er gebeurt,
          wat de verkoper moet doen, en wat de financiële gevolgen zijn. */}
      <BuybackOutcomeInfo request={request} />

      {/* Fase 6: keuze na aangepaste berekening of afkeur */}
      <BuybackDecision request={{ id: request.id, status: request.status, userDecision: request.userDecision, decisionDeadline: request.decisionDeadline ? new Date(request.decisionDeadline).toISOString() : null, finalPayout: request.finalPayout, returnPayment: request.returnPayment }} />

      {(request.returnCarrier || request.returnTrackingNumber) && (
        <div className="dash-card p-5 text-sm">
          <p className="flex items-center gap-2 font-semibold"><Truck className="h-4 w-4" /> Retourzending</p>
          <p className="mt-1 text-muted-foreground">{request.returnCarrier} · <span className="font-mono">{request.returnTrackingNumber}</span>{request.returnedAt ? ` · verzonden op ${new Date(request.returnedAt).toLocaleDateString("nl-NL")}` : ""}</p>
        </div>
      )}

      {/* Status timeline */}
      <div className="dash-card p-5">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{t("requestType")}:</span>
          <span>{request.type === "COLLECTION" ? t("typeCollection") : t("typeBulk")}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="font-medium">{t("payoutMethod")}:</span>
          <span className="flex items-center gap-1"><Banknote className="h-4 w-4" /> {t("payoutBank")}</span>
        </div>
        {request.payoutMethod === "BANK" && request.iban && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="font-medium">{t("ibanLabel")}:</span>
            <span className="font-mono">{request.iban}</span>
          </div>
        )}
      </div>

      {/* Collection items */}
      {request.type === "COLLECTION" && request.items.length > 0 && (
        <div className="dash-card overflow-hidden">
          <div className="divide-y divide-border">
            {request.items.map((item) => {
              const Icon = ITEM_STATUS_ICON[item.inspectionStatus] ?? Clock;
              const color = ITEM_STATUS_COLOR[item.inspectionStatus] ?? "text-muted-foreground";
              const correctionReadOnly = request.status !== "INSPECTING";

              return (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-8 shrink-0 overflow-hidden rounded-[4px] bg-[var(--muted)]">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.cardName} width={32} height={48} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[8px] text-muted-foreground">?</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.cardName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.setName} · #{item.cardLocalId}
                      </p>
                      {item.rejectionReason && (
                        <p className="text-xs font-medium text-[var(--destructive)]">{item.rejectionReason}</p>
                      )}
                    </div>
                    <div className="text-center text-sm">
                      <span className="text-muted-foreground">{item.quantity}x</span>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">€{(item.buybackPrice * item.quantity).toFixed(2)}</p>
                    </div>
                    <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                  </div>
                  {item.priceCorrected && (
                    <PriceCorrectionPrompt
                      itemId={item.id}
                      cardName={item.cardName}
                      originalBuybackPrice={item.buybackPrice}
                      correctedMarketPrice={item.correctedMarketPrice ?? 0}
                      correctedBuybackPrice={item.correctedBuybackPrice ?? 0}
                      reason={item.priceCorrectionReason ?? ""}
                      userApprovedCorrection={item.userApprovedCorrection}
                      readOnly={correctionReadOnly}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk items */}
      {request.type === "BULK" && request.bulkItems.length > 0 && (
        <div className="dash-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={cn(TABLE_HEAD, "bg-[var(--background)]")}>
              <tr>
                <th className={TABLE_CELL}>{t("bulkCategory")}</th>
                <th className={cn(TABLE_CELL, "text-center")}>{t("quantity")}</th>
                <th className={cn(TABLE_CELL, "text-center")}>{t("approvedQuantity")}</th>
                <th className={cn(TABLE_CELL, "text-right")}>{t("bulkSubtotal")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {request.bulkItems.map((item) => {
                const label = categoryLabels[item.category] ?? item.category;
                return (
                  <tr key={item.id}>
                    <td className={cn(TABLE_CELL, "font-medium")}>{label}</td>
                    <td className={cn(TABLE_CELL, "text-center tabular-nums")}>{item.quantity}</td>
                    <td className={cn(TABLE_CELL, "text-center tabular-nums")}>
                      {item.approvedQuantity !== null ? (
                        <span
                          className={cn(
                            "cc-pill inline-flex px-2 py-0.5 text-xs font-semibold text-foreground",
                            item.approvedQuantity < item.quantity ? "bg-[var(--pastel-yellow)]" : "bg-[var(--pastel-green)]"
                          )}
                        >
                          {item.approvedQuantity}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={cn(TABLE_CELL, "text-right tabular-nums")}>€{item.subtotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tracking form + packing link — alleen relevant zolang het pakket nog
          niet bij Cards Center is. Vanaf RECEIVED+ verbergen we beide. */}
      {request.status === "PENDING" && (
        <>
          <TrackingForm
            requestId={request.id}
            initialCarrier={request.shippingCarrier}
            initialTrackingNumber={request.trackingNumber}
            shippedAt={request.shippedAt ? new Date(request.shippedAt).toISOString() : null}
            shippingDeadline={request.shippingDeadline ? new Date(request.shippingDeadline).toISOString() : null}
            canEdit
          />
          <Link
            href="/verkopen/verpakken"
            target="_blank"
            rel="noopener noreferrer"
            className={cn("flex items-center gap-3 rounded-[14px] p-4 transition-opacity hover:opacity-90", TONE_SURFACE.yellow)}
          >
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", TONE_ICON.ink)}>
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("packingInstructionsLink")}</p>
              <p className="text-xs opacity-80">{t("packingInstructionsLinkDesc")}</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0" />
          </Link>
        </>
      )}

      {/* Payout summary */}
      <div className="dash-card p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm">{t("estimatedPayoutLabel")}</span>
          <span className="font-medium">€{request.estimatedPayout.toFixed(2)}</span>
        </div>
        {request.finalPayout !== null && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-medium">{t("finalPayoutLabel")}</span>
            <span className="cc-display text-2xl tabular-nums text-foreground">
              €{request.finalPayout.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* FAQ — antwoorden op alle veelvoorkomende vragen zodat de verkoper
          niet hoeft te mailen voor info. */}
      <BuybackFAQ type={request.type} />

      {/* Cancel button */}
      {canCancel && (
        <div>
          {!showCancel ? (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="text-sm font-semibold text-[var(--destructive)] hover:underline"
            >
              {t("cancelRequest")}
            </button>
          ) : (
            <div className="dash-card p-5">
              <p className="mb-3 text-sm">{t("cancelConfirm")}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isPending}
                  className="cc-pill inline-flex h-9 items-center bg-[var(--destructive)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--destructive)]/90 disabled:opacity-50"
                >
                  {t("cancelRequest")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancel(false)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {t("backToOverview")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
