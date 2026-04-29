"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { BuybackStatusBadge } from "./buyback-status-badge";
import {
  updateBuybackStatus,
  inspectBuybackItem,
  inspectBulkBuybackItem,
  finalizeBuybackInspection,
  applyItemPriceCorrection,
} from "@/actions/buyback";
import { BULK_PRICING, type BulkCategoryKey, getBuybackPrice } from "@/lib/buyback-pricing";
import { CheckCircle2, XCircle, Banknote, Wallet, AlertTriangle, Pencil, Clock, ChevronDown } from "lucide-react";
import type { BuybackRequest, BuybackItem, BulkBuybackItem } from "@prisma/client";

type RequestWithAll = BuybackRequest & {
  user: { displayName: string; email: string };
  items: BuybackItem[];
  bulkItems: BulkBuybackItem[];
};

const REJECTION_REASONS = [
  { key: "rejectionNotNM", value: "Not Near Mint" },
  { key: "rejectionOffCenter", value: "Off-center" },
  { key: "rejectionWrongCard", value: "Wrong card" },
  { key: "rejectionDamaged", value: "Damaged" },
  { key: "rejectionCounterfeit", value: "Counterfeit" },
];

export function AdminBuybackDetail({ request }: { request: RequestWithAll }) {
  const t = useTranslations("buyback");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adminNotes, setAdminNotes] = useState(request.adminNotes ?? "");
  const [bulkApproved, setBulkApproved] = useState<Record<string, number>>(
    Object.fromEntries(request.bulkItems.map((i) => [i.id, i.approvedQuantity ?? i.quantity]))
  );

  function handleStatusChange(newStatus: string) {
    startTransition(async () => {
      const result = await updateBuybackStatus(request.id, newStatus, adminNotes || undefined);
      if (result?.success) {
        toast.success(`Status bijgewerkt naar ${newStatus}`);
        router.refresh();
      } else {
        toast.error(result?.error ?? "Er ging iets mis");
      }
    });
  }

  function handleItemInspect(itemId: string, status: "APPROVED" | "REJECTED", reason?: string) {
    startTransition(async () => {
      const result = await inspectBuybackItem(itemId, status, reason);
      if (result?.success) {
        toast.success("Item bijgewerkt");
        router.refresh();
      } else {
        toast.error(result?.error ?? "Er ging iets mis");
      }
    });
  }

  function handleBulkInspect(itemId: string) {
    const qty = bulkApproved[itemId] ?? 0;
    startTransition(async () => {
      const result = await inspectBulkBuybackItem(itemId, qty);
      if (result?.success) {
        toast.success("Categorie bijgewerkt");
        router.refresh();
      } else {
        toast.error(result?.error ?? "Er ging iets mis");
      }
    });
  }

  function handleFinalize() {
    startTransition(async () => {
      const result = await finalizeBuybackInspection(request.id);
      if (result?.success) {
        toast.success(`Inspectie afgerond: ${result.status} — €${result.finalPayout?.toFixed(2)}`);
        router.refresh();
      } else {
        toast.error(result?.error ?? "Er ging iets mis");
      }
    });
  }

  // Status action buttons
  const statusActions = [];
  if (request.status === "PENDING") {
    statusActions.push({ label: t("adminMarkReceived"), status: "RECEIVED", color: "bg-blue-600 hover:bg-blue-700" });
  }
  if (request.status === "RECEIVED") {
    statusActions.push({ label: t("adminStartInspection"), status: "INSPECTING", color: "bg-indigo-600 hover:bg-indigo-700" });
  }
  if (request.status === "APPROVED" || request.status === "PARTIALLY_APPROVED") {
    statusActions.push({ label: t("adminMarkPaid"), status: "PAID", color: "bg-emerald-600 hover:bg-emerald-700" });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{request.user.displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {request.user.email} · {request.type} · {request.id.slice(0, 8)}
          </p>
        </div>
        <BuybackStatusBadge status={request.status} />
      </div>

      {/* Shipping info — admins zien alle verzendgegevens van de verkoper */}
      {request.type === "BULK" && (
        <div className="glass rounded-xl p-4">
          <h3 className="mb-2 text-sm font-semibold">Verzending</h3>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Verzenddeadline</p>
              <p className="font-medium">
                {request.shippingDeadline
                  ? new Date(request.shippingDeadline).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Vervoerder</p>
              <p className="font-medium">{request.shippingCarrier ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Track &amp; Trace</p>
              <p className="font-mono text-xs">{request.trackingNumber ?? "—"}</p>
            </div>
            {request.shippedAt && (
              <div className="md:col-span-3">
                <p className="text-muted-foreground">Tracking ingevoerd op</p>
                <p>{new Date(request.shippedAt).toLocaleString("nl-NL")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payout info */}
      <div className="glass rounded-xl p-4">
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{t("payoutMethod")}</p>
            <p className="flex items-center gap-1 font-medium">
              {request.payoutMethod === "BANK" ? (
                <><Banknote className="h-4 w-4" /> {t("payoutBank")}</>
              ) : (
                <><Wallet className="h-4 w-4" /> {t("payoutStoreCredit")}</>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("estimatedPayoutLabel")}</p>
            <p className="font-medium">€{request.estimatedPayout.toFixed(2)}</p>
          </div>
          {request.finalPayout !== null && (
            <div>
              <p className="text-muted-foreground">{t("finalPayoutLabel")}</p>
              <p className="font-bold text-emerald-600">€{request.finalPayout.toFixed(2)}</p>
            </div>
          )}
        </div>
        {request.iban && (
          <p className="mt-2 text-sm">
            IBAN: <span className="font-mono">{request.iban}</span> — {request.accountHolder}
          </p>
        )}
      </div>

      {/* Collection items inspection */}
      {request.type === "COLLECTION" && request.items.length > 0 && (
        <div className="glass overflow-hidden rounded-xl">
          <div className="border-b border-border/50 p-3">
            <h3 className="font-semibold">Kaarten ({request.items.length})</h3>
          </div>
          <div className="divide-y divide-border/30">
            {request.items.map((item) => (
              <AdminCollectionItemRow
                key={item.id}
                item={item}
                requestStatus={request.status}
                isPending={isPending}
                onInspect={handleItemInspect}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bulk items inspection */}
      {request.type === "BULK" && request.bulkItems.length > 0 && (
        <div className="glass overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">{t("bulkCategory")}</th>
                <th className="px-4 py-2 text-center">Ingediend</th>
                <th className="px-4 py-2 text-center">{t("approvedQuantity")}</th>
                <th className="px-4 py-2 text-right">Subtotaal</th>
                <th className="px-4 py-2"></th>
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
                      {request.status === "INSPECTING" ? (
                        <input
                          type="number"
                          min={0}
                          max={item.quantity}
                          value={bulkApproved[item.id] ?? 0}
                          onChange={(e) =>
                            setBulkApproved((prev) => ({
                              ...prev,
                              [item.id]: Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0)),
                            }))
                          }
                          className="w-20 rounded border border-input bg-background px-2 py-1 text-center text-sm"
                        />
                      ) : (
                        <span>{item.approvedQuantity ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">€{item.subtotal.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      {request.status === "INSPECTING" && (
                        <button
                          type="button"
                          onClick={() => handleBulkInspect(item.id)}
                          disabled={isPending}
                          className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                          Opslaan
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin notes */}
      <div>
        <label className="mb-1 block text-sm font-medium">{t("adminNotes")}</label>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder={t("adminNotesPlaceholder")}
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Status action buttons */}
      <div className="flex flex-wrap gap-3">
        {statusActions.map((action) => (
          <button
            key={action.status}
            type="button"
            onClick={() => handleStatusChange(action.status)}
            disabled={isPending}
            className={`rounded-xl px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${action.color}`}
          >
            {action.label}
          </button>
        ))}

        {request.status === "INSPECTING" && (
          <button
            type="button"
            onClick={handleFinalize}
            disabled={isPending}
            className="rounded-xl bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {t("adminFinalizeInspection")}
          </button>
        )}
      </div>
    </div>
  );
}

// ── AdminCollectionItemRow ──────────────────────────────────────────────────

interface AdminCollectionItemRowProps {
  item: BuybackItem;
  requestStatus: string;
  isPending: boolean;
  onInspect: (itemId: string, status: "APPROVED" | "REJECTED", reason?: string) => void;
}

function AdminCollectionItemRow({ item, requestStatus, isPending, onInspect }: AdminCollectionItemRowProps) {
  const t = useTranslations("buyback");
  const router = useRouter();
  const [, startTx] = useTransition();
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [showRejectMenu, setShowRejectMenu] = useState(false);
  const [correctedPrice, setCorrectedPrice] = useState("");
  const [reason, setReason] = useState("");

  const isInspectingPhase = requestStatus === "INSPECTING";
  const canTakeAction = isInspectingPhase && item.inspectionStatus === "PENDING";

  function submitCorrection() {
    const price = parseFloat(correctedPrice.replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Vul een geldige prijs in");
      return;
    }
    startTx(async () => {
      const result = await applyItemPriceCorrection(item.id, price, reason);
      if (result?.success) {
        toast.success("Prijscorrectie verzonden — verkoper moet nu reageren");
        setShowCorrectionForm(false);
        setCorrectedPrice("");
        setReason("");
        router.refresh();
      } else {
        toast.error(result?.error ?? "Er ging iets mis");
      }
    });
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-3">
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.cardName} width={40} height={56} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-xs">?</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.cardName}</p>
          <p className="text-xs text-muted-foreground">
            {item.setName} · #{item.cardLocalId} · {item.quantity}x · €{item.buybackPrice.toFixed(2)}/st
          </p>
        </div>

        {canTakeAction ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onInspect(item.id, "APPROVED")}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              title={t("adminApprove")}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Goedkeuren</span>
            </button>

            {/* Reject dropdown — single button + menu with reasons */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRejectMenu((v) => !v)}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                title="Afkeuren met reden"
              >
                <XCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Afkeuren</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {showRejectMenu && (
                <>
                  {/* Click-outside backdrop */}
                  <button
                    type="button"
                    onClick={() => setShowRejectMenu(false)}
                    className="fixed inset-0 z-30 cursor-default"
                    aria-hidden
                  />
                  <div className="absolute right-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                    {REJECTION_REASONS.map((rj) => (
                      <button
                        key={rj.key}
                        type="button"
                        onClick={() => {
                          setShowRejectMenu(false);
                          onInspect(item.id, "REJECTED", rj.value);
                        }}
                        disabled={isPending}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                      >
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        {t(rj.key)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowCorrectionForm((v) => !v)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              title="Prijsfout — voer correctie in"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Prijs</span>
            </button>
          </div>
        ) : (
          <div className="text-sm">
            {item.inspectionStatus === "APPROVED" && (
              <span className="font-medium text-emerald-600">{t("adminApprove")}</span>
            )}
            {item.inspectionStatus === "REJECTED" && (
              <span className="text-red-500">{item.rejectionReason}</span>
            )}
            {item.inspectionStatus === "PENDING" && (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        )}
      </div>

      {/* Existing price-correction state */}
      {item.priceCorrected && (
        <div className="mt-2 rounded-lg border-l-4 border-amber-400 bg-amber-50/70 p-3 text-xs dark:border-amber-500 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <div className="min-w-0">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Prijscorrectie:{" "}
                <span className="font-mono">€{item.buybackPrice.toFixed(2)}</span> →{" "}
                <span className="font-mono font-semibold">
                  €{(item.correctedBuybackPrice ?? 0).toFixed(2)}
                </span>{" "}
                <span className="text-amber-700/80 dark:text-amber-300/80">
                  (Marktprijs €{(item.correctedMarketPrice ?? 0).toFixed(2)})
                </span>
              </p>
              <p className="mt-1 italic text-amber-800/90 dark:text-amber-200/90">
                Reden: {item.priceCorrectionReason}
              </p>
              <p className="mt-1 text-amber-800/80 dark:text-amber-300/80">
                Verkoper:{" "}
                {item.userApprovedCorrection === null ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> wacht op reactie
                  </span>
                ) : item.userApprovedCorrection ? (
                  <span className="font-medium text-emerald-600">geaccepteerd</span>
                ) : (
                  <span className="font-medium text-red-600">afgewezen</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Inline form for new correction */}
      {showCorrectionForm && canTakeAction && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50/40 p-3 dark:border-amber-700/50 dark:bg-amber-950/20">
          <p className="mb-2 text-xs font-medium text-amber-900 dark:text-amber-100">
            Prijsfout corrigeren — vul de juiste Marktprijs in. Inkoopprijs wordt automatisch berekend (85%).
          </p>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
            <input
              type="text"
              inputMode="decimal"
              value={correctedPrice}
              onChange={(e) => setCorrectedPrice(e.target.value)}
              placeholder="Marktprijs €"
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm tabular-nums"
            />
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reden (bv. verkeerde variant gemapt)"
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
              maxLength={200}
            />
            <button
              type="button"
              onClick={submitCorrection}
              disabled={isPending || !correctedPrice.trim() || reason.trim().length < 3}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Versturen
            </button>
          </div>
          {correctedPrice && Number.isFinite(parseFloat(correctedPrice.replace(",", "."))) && (
            <p className="mt-1.5 text-[11px] text-amber-800/80 dark:text-amber-300/80">
              → Inkoopprijs wordt: €{getBuybackPrice(parseFloat(correctedPrice.replace(",", "."))).toFixed(2)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
