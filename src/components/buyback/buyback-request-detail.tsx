"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { BuybackStatusBadge } from "./buyback-status-badge";
import { cancelBuybackRequest } from "@/actions/buyback";
import { X, CheckCircle2, XCircle, Clock, CreditCard, Banknote, Wallet } from "lucide-react";
import type { BuybackRequest, BuybackItem, BulkBuybackItem } from "@prisma/client";
import { BULK_PRICING, type BulkCategoryKey } from "@/lib/buyback-pricing";

type RequestWithItems = BuybackRequest & {
  items: BuybackItem[];
  bulkItems: BulkBuybackItem[];
};

const ITEM_STATUS_ICON: Record<string, typeof CheckCircle2> = {
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  PENDING: Clock,
};

const ITEM_STATUS_COLOR: Record<string, string> = {
  APPROVED: "text-emerald-500",
  REJECTED: "text-red-500",
  PENDING: "text-yellow-500",
};

export function BuybackRequestDetail({ request }: { request: RequestWithItems }) {
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{t("requestDetail")}</h2>
          <p className="text-sm text-muted-foreground">
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

      {/* Status timeline */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{t("requestType")}:</span>
          <span>{request.type === "COLLECTION" ? t("typeCollection") : t("typeBulk")}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="font-medium">{t("payoutMethod")}:</span>
          <span className="flex items-center gap-1">
            {request.payoutMethod === "BANK" ? (
              <><Banknote className="h-4 w-4" /> {t("payoutBank")}</>
            ) : (
              <><Wallet className="h-4 w-4" /> {t("payoutStoreCredit")}</>
            )}
          </span>
        </div>
        {request.payoutMethod === "BANK" && request.iban && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="font-medium">{t("ibanLabel")}:</span>
            <span className="font-mono">
              {request.iban.slice(0, 4)}****{request.iban.slice(-4)}
            </span>
          </div>
        )}
      </div>

      {/* Collection items */}
      {request.type === "COLLECTION" && request.items.length > 0 && (
        <div className="glass overflow-hidden rounded-xl">
          <div className="divide-y divide-border/30">
            {request.items.map((item) => {
              const Icon = ITEM_STATUS_ICON[item.inspectionStatus] ?? Clock;
              const color = ITEM_STATUS_COLOR[item.inspectionStatus] ?? "text-muted-foreground";

              return (
                <div key={item.id} className="flex items-center gap-3 p-3">
                  <div className="h-12 w-8 shrink-0 overflow-hidden rounded">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.cardName} width={32} height={48} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-[8px]">?</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.cardName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.setName} · #{item.cardLocalId}
                    </p>
                    {item.rejectionReason && (
                      <p className="text-xs text-red-500">{item.rejectionReason}</p>
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
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk items */}
      {request.type === "BULK" && request.bulkItems.length > 0 && (
        <div className="glass overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">{t("bulkCategory")}</th>
                <th className="px-4 py-2 text-center">{t("quantity")}</th>
                <th className="px-4 py-2 text-center">{t("approvedQuantity")}</th>
                <th className="px-4 py-2 text-right">{t("bulkSubtotal")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {request.bulkItems.map((item) => {
                const config = BULK_PRICING[item.category as BulkCategoryKey];
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-medium">{config ? t(config.labelKey) : item.category}</td>
                    <td className="px-4 py-2 text-center">{item.quantity}</td>
                    <td className="px-4 py-2 text-center">
                      {item.approvedQuantity !== null ? (
                        <span className={item.approvedQuantity < item.quantity ? "text-amber-600" : "text-emerald-600"}>
                          {item.approvedQuantity}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">€{item.subtotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Payout summary */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">{t("estimatedPayoutLabel")}</span>
          <span className="font-medium">€{request.estimatedPayout.toFixed(2)}</span>
        </div>
        {request.finalPayout !== null && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-medium">{t("finalPayoutLabel")}</span>
            <span className="text-lg font-bold text-emerald-600">
              €{request.finalPayout.toFixed(2)}
            </span>
          </div>
        )}
        {request.storeCreditBonus !== null && request.storeCreditBonus > 0 && (
          <div className="mt-1 flex items-center justify-between text-emerald-600">
            <span className="text-sm">{t("storeCreditBonus")}</span>
            <span className="font-medium">+€{request.storeCreditBonus.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Cancel button */}
      {canCancel && (
        <div>
          {!showCancel ? (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="text-sm text-red-500 hover:text-red-600"
            >
              {t("cancelRequest")}
            </button>
          ) : (
            <div className="glass rounded-xl p-4">
              <p className="mb-3 text-sm">{t("cancelConfirm")}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isPending}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {t("cancelRequest")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancel(false)}
                  className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted/50"
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
