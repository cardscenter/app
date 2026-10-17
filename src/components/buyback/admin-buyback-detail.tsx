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
  markBuybackReturned,
} from "@/actions/buyback";
import { getBuybackPrice } from "@/lib/buyback-pricing";
import { canMarkPaid, RETURN_FEE_EUR } from "@/lib/buyback-status";
import { CheckCircle2, XCircle, Banknote, AlertTriangle, Pencil, Clock, ChevronDown, Truck } from "lucide-react";
import type { BuybackRequest, BuybackItem, BulkBuybackItem } from "@prisma/client";
import { Callout } from "@/components/dashboard/ui/callout";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { H2, H3, INPUT, LABEL, MENU, PILL_BTN_SM, PILL_INK, PILL_RED, PILL_RED_SM, SELECT, TABLE_HEAD, TEXTAREA } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

type RequestWithAll = Omit<BuybackRequest, "iban"> & {
  /** Ontsleuteld door de page (admin ziet het volledige IBAN). */
  iban: string | null;
  user: { displayName: string; email: string };
  items: BuybackItem[];
  bulkItems: BulkBuybackItem[];
  returnPayment: { status: string; paidAt: string | null } | null;
};

const REJECTION_REASONS = [
  { key: "rejectionNotNM", value: "Not Near Mint" },
  { key: "rejectionOffCenter", value: "Off-center" },
  { key: "rejectionWrongCard", value: "Wrong card" },
  { key: "rejectionDamaged", value: "Damaged" },
  { key: "rejectionCounterfeit", value: "Counterfeit" },
];

export function AdminBuybackDetail({ request, categoryLabels = {} }: { request: RequestWithAll; categoryLabels?: Record<string, string> }) {
  const t = useTranslations("buyback");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adminNotes, setAdminNotes] = useState(request.adminNotes ?? "");
  const [returnCarrier, setReturnCarrier] = useState("PostNL");
  const [returnTracking, setReturnTracking] = useState("");
  const paidGate = canMarkPaid(request);
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
        toast.success(`Inspectie afgerond: ${result.status}, €${result.finalPayout?.toFixed(2)}`);
        router.refresh();
      } else {
        toast.error(result?.error ?? "Er ging iets mis");
      }
    });
  }

  // Status action buttons
  const statusActions: Array<{ label: string; status: string; color: string; disabled?: boolean; hint?: string }> = [];
  if (request.status === "PENDING") {
    statusActions.push({ label: t("adminMarkReceived"), status: "RECEIVED", color: "bg-foreground hover:bg-foreground/85" });
  }
  if (request.status === "RECEIVED") {
    statusActions.push({ label: t("adminStartInspection"), status: "INSPECTING", color: "bg-foreground hover:bg-foreground/85" });
  }
  if (request.status === "APPROVED" || request.status === "PARTIALLY_APPROVED" || request.status === "RETURNED") {
    statusActions.push({ label: t("adminMarkPaid"), status: "PAID", color: "cc-grad", disabled: !paidGate.ok, hint: paidGate.reason });
  }

  function handleReturned() {
    startTransition(async () => {
      const result = await markBuybackReturned(request.id, returnCarrier, returnTracking);
      if (result?.success) {
        toast.success("Retour vastgelegd");
        router.refresh();
      } else {
        toast.error(result?.error ?? "Er ging iets mis");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={H2}>{request.user.displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {request.user.email} · {request.type} · {request.id.slice(0, 8)}
          </p>
        </div>
        <BuybackStatusBadge status={request.status} />
      </div>

      {/* Shipping info — admins zien alle verzendgegevens van de verkoper */}
      {request.type === "BULK" && (
        <div className="dash-card p-5">
          <h3 className={cn(H3, "mb-3")}>Verzending</h3>
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
                  : "·"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Vervoerder</p>
              <p className="font-medium">{request.shippingCarrier ?? "·"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Track &amp; Trace</p>
              <p className="font-mono text-xs">{request.trackingNumber ?? "·"}</p>
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
      <div className="dash-card p-5">
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{t("payoutMethod")}</p>
            <p className="flex items-center gap-1 font-medium"><Banknote className="h-4 w-4" /> {t("payoutBank")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("estimatedPayoutLabel")}</p>
            <p className="font-medium">€{request.estimatedPayout.toFixed(2)}</p>
          </div>
          {request.finalPayout !== null && (
            <div>
              <p className="text-muted-foreground">{t("finalPayoutLabel")}</p>
              <p className="cc-display text-2xl tabular-nums text-foreground">€{request.finalPayout.toFixed(2)}</p>
            </div>
          )}
        </div>
        {request.iban && (
          <p className="mt-3 text-sm">
            IBAN: <span className="font-mono">{request.iban}</span> · {request.accountHolder}
          </p>
        )}
      </div>

      {/* Collection items inspection */}
      {request.type === "COLLECTION" && request.items.length > 0 && (
        <div className="dash-card overflow-hidden">
          <div className="px-5 pb-2 pt-5">
            <h3 className={H3}>Kaarten ({request.items.length})</h3>
          </div>
          <div className="divide-y divide-border">
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
        <div className="dash-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={cn(TABLE_HEAD, "bg-[var(--background)]")}>
              <tr>
                <th className="px-4 py-3">{t("bulkCategory")}</th>
                <th className="px-4 py-3 text-center">Ingediend</th>
                <th className="px-4 py-3 text-center">{t("approvedQuantity")}</th>
                <th className="px-4 py-3 text-right">Subtotaal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {request.bulkItems.map((item) => {
                const label = categoryLabels[item.category] ?? item.category;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-medium">{label}</td>
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
                          className={cn(INPUT, "w-20 px-2 py-1 text-center")}
                        />
                      ) : (
                        <span>{item.approvedQuantity ?? "·"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">€{item.subtotal.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      {request.status === "INSPECTING" && (
                        <button
                          type="button"
                          onClick={() => handleBulkInspect(item.id)}
                          disabled={isPending}
                          className={cn(PILL_RED_SM, "disabled:opacity-50")}
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
        </div>
      )}

      {/* Admin notes */}
      <div>
        <label className={LABEL}>{t("adminNotes")}</label>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder={t("adminNotesPlaceholder")}
          rows={3}
          className={TEXTAREA}
        />
      </div>

      {/* Status action buttons */}
      <div className="flex flex-wrap gap-3">
        {statusActions.map((action) => (
          <button
            key={action.status}
            type="button"
            onClick={() => handleStatusChange(action.status)}
            disabled={isPending || action.disabled}
            title={action.hint}
            className={`cc-pill inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${action.color}`}
          >
            {action.label}
          </button>
        ))}
        {statusActions.some((a) => a.disabled && a.hint) && (
          <p className="basis-full text-xs text-muted-foreground">{statusActions.find((a) => a.disabled)?.hint}</p>
        )}
        {(request.status === "PARTIALLY_APPROVED" || request.status === "REJECTED") && (
          <p className="basis-full text-xs text-muted-foreground">
            Keuze verkoper: {request.userDecision === "ACCEPT" ? "akkoord met de aangepaste berekening" : request.userDecision === "RETURN" ? "retour" : "nog geen keuze"}
            {request.decisionDeadline ? ` (termijn tot ${new Date(request.decisionDeadline).toLocaleDateString("nl-NL")})` : ""}
            {request.returnPayment ? ` · retourbetaling €${RETURN_FEE_EUR.toFixed(2)}: ${request.returnPayment.status}` : ""}
          </p>
        )}
        {request.status === "RETURN_REQUESTED" && (
          <Callout tone="blue" icon={Truck} className="basis-full">
            <p className="font-semibold">Retourkosten betaald: stuur de kaarten terug en vul de Track &amp; Trace in</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select value={returnCarrier} onChange={(e) => setReturnCarrier(e.target.value)} className={cn(SELECT, "w-auto")}>
                {["PostNL", "DPD", "DHL", "UPS", "OTHER"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input value={returnTracking} onChange={(e) => setReturnTracking(e.target.value)} placeholder="Track &amp; Trace-code" className={cn(INPUT, "w-auto min-w-[14rem] flex-1 font-mono")} />
              <button type="button" onClick={handleReturned} disabled={isPending || returnTracking.trim().length < 4} className={cn(PILL_INK, "disabled:opacity-50")}>Retour verzonden</button>
            </div>
          </Callout>
        )}
        {request.returnedAt && (
          <p className="basis-full text-xs text-muted-foreground">Retour verzonden op {new Date(request.returnedAt).toLocaleDateString("nl-NL")} via {request.returnCarrier} ({request.returnTrackingNumber}).</p>
        )}

        {request.status === "INSPECTING" && (
          <button
            type="button"
            onClick={handleFinalize}
            disabled={isPending}
            className={cn(PILL_RED, "disabled:opacity-50")}
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
        toast.success("Prijscorrectie verzonden. De verkoper moet nu reageren.");
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
    <div className="px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-[6px] bg-[var(--muted)]">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.cardName} width={40} height={56} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-xs">?</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.cardName}</p>
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
              className={cn(PILL_INK, "px-3 py-2 text-xs disabled:opacity-50")}
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
                className="cc-pill inline-flex items-center gap-1.5 bg-destructive px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
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
                  <div className={cn(MENU, "absolute right-0 top-full z-40 mt-1 w-48 overflow-hidden p-1")}>
                    {REJECTION_REASONS.map((rj) => (
                      <button
                        key={rj.key}
                        type="button"
                        onClick={() => {
                          setShowRejectMenu(false);
                          onInspect(item.id, "REJECTED", rj.value);
                        }}
                        disabled={isPending}
                        className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-[var(--pastel-pink)] hover:text-[var(--pastel-pink-ink)]"
                      >
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
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
              className={cn(PILL_BTN_SM, "py-2 disabled:opacity-50")}
              title="Prijsfout: voer een correctie in"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Prijs</span>
            </button>
          </div>
        ) : (
          <div className="text-sm">
            {item.inspectionStatus === "APPROVED" && (
              <StatusBadge tone="success">{t("adminApprove")}</StatusBadge>
            )}
            {item.inspectionStatus === "REJECTED" && (
              <StatusBadge tone="danger">{item.rejectionReason}</StatusBadge>
            )}
            {item.inspectionStatus === "PENDING" && (
              <span className="text-muted-foreground">·</span>
            )}
          </div>
        )}
      </div>

      {/* Existing price-correction state */}
      {item.priceCorrected && (
        <Callout tone="yellow" icon={AlertTriangle} className="mt-2 text-xs">
            <div className="min-w-0">
              <p className="font-semibold">
                Prijscorrectie:{" "}
                <span className="font-mono">€{item.buybackPrice.toFixed(2)}</span> →{" "}
                <span className="font-mono font-semibold">
                  €{(item.correctedBuybackPrice ?? 0).toFixed(2)}
                </span>{" "}
                <span className="opacity-75">
                  (Marktprijs €{(item.correctedMarketPrice ?? 0).toFixed(2)})
                </span>
              </p>
              <p className="mt-1 italic opacity-90">
                Reden: {item.priceCorrectionReason}
              </p>
              <p className="mt-1 opacity-85">
                Verkoper:{" "}
                {item.userApprovedCorrection === null ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> wacht op reactie
                  </span>
                ) : item.userApprovedCorrection ? (
                  <StatusBadge tone="success">geaccepteerd</StatusBadge>
                ) : (
                  <StatusBadge tone="danger">afgewezen</StatusBadge>
                )}
              </p>
            </div>
        </Callout>
      )}

      {/* Inline form for new correction */}
      {showCorrectionForm && canTakeAction && (
        <div className="mt-2 rounded-[14px] bg-[var(--pastel-yellow)] p-3 text-[var(--pastel-yellow-ink)]">
          <p className="mb-2 text-xs font-semibold">
            Prijsfout corrigeren: vul de juiste Marktprijs in. De inkoopprijs wordt automatisch berekend (85%).
          </p>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
            <input
              type="text"
              inputMode="decimal"
              value={correctedPrice}
              onChange={(e) => setCorrectedPrice(e.target.value)}
              placeholder="Marktprijs €"
              className={cn(INPUT, "py-1.5 tabular-nums")}
            />
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reden (bv. verkeerde variant gemapt)"
              className={cn(INPUT, "py-1.5")}
              maxLength={200}
            />
            <button
              type="button"
              onClick={submitCorrection}
              disabled={isPending || !correctedPrice.trim() || reason.trim().length < 3}
              className={cn(PILL_INK, "px-4 py-1.5 text-xs disabled:opacity-50")}
            >
              Versturen
            </button>
          </div>
          {correctedPrice && Number.isFinite(parseFloat(correctedPrice.replace(",", "."))) && (
            <p className="mt-1.5 text-[11px] opacity-80">
              → Inkoopprijs wordt: €{getBuybackPrice(parseFloat(correctedPrice.replace(",", "."))).toFixed(2)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
