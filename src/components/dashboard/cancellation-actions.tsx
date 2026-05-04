"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Ban, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  requestCancellation,
  respondToCancellation,
  getActiveCancellationRequest,
} from "@/actions/cancellation";
import { CANCELLATION_REASONS, type CancellationReason } from "@/lib/cancellation-config";

interface CancellationActionsProps {
  bundleId: string;
  currentUserId: string;
  bundleStatus: string;
}

interface PendingRequest {
  id: string;
  reason: string;
  details: string | null;
  expiresAt: string;
  proposedBy: { id: string; displayName: string };
}

export function CancellationActions({ bundleId, currentUserId, bundleStatus }: CancellationActionsProps) {
  const t = useTranslations("cancellation");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reason, setReason] = useState<CancellationReason>("SELLER_OUT_OF_STOCK");
  const [details, setDetails] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  // Bumpen na een mutatie zodat de useEffect opnieuw fetcht — router.refresh()
  // re-fetcht alleen RSC-payload, deze client-component re-runt niet vanzelf.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (bundleStatus !== "PAID") {
      setLoading(false);
      setRequest(null);
      return;
    }
    setLoading(true);
    getActiveCancellationRequest(bundleId).then((r) => {
      if (r) {
        setRequest({
          id: r.id,
          reason: r.reason,
          details: r.details,
          expiresAt: r.expiresAt.toISOString(),
          proposedBy: r.proposedBy,
        });
      } else {
        setRequest(null);
      }
      setLoading(false);
    });
  }, [bundleId, bundleStatus, refreshKey]);

  if (bundleStatus !== "PAID") return null;
  if (loading) return null;

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("reason", reason);
    if (details.trim()) formData.set("details", details);

    startTransition(async () => {
      const result = await requestCancellation(bundleId, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("requestSubmitted"));
      setShowRequestForm(false);
      setDetails("");
      setRefreshKey((k) => k + 1);
      router.refresh();
    });
  }

  function handleAccept() {
    if (!request) return;
    if (!confirm(t("confirmAccept"))) return;
    startTransition(async () => {
      const result = await respondToCancellation(request.id, "ACCEPT");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("accepted"));
      setRefreshKey((k) => k + 1);
      router.refresh();
    });
  }

  function handleReject() {
    if (!request) return;
    startTransition(async () => {
      const result = await respondToCancellation(request.id, "REJECT", rejectionNote);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("rejected"));
      setShowRejectForm(false);
      setRejectionNote("");
      setRefreshKey((k) => k + 1);
      router.refresh();
    });
  }

  // Format helper voor "Verloopt over X dagen/uur/minuten" — i18n-vriendelijk
  // doordat we per granulariteit een aparte key gebruiken
  function formatExpiresIn(expiresAt: Date): string {
    const ms = expiresAt.getTime() - Date.now();
    if (ms <= 0) return t("expiresInExpired");
    const minutes = Math.ceil(ms / (1000 * 60));
    if (minutes < 60) return t("expiresInMinutes", { count: minutes });
    const hours = Math.ceil(minutes / 60);
    if (hours < 24) return t("expiresInHours", { count: hours });
    const days = Math.ceil(hours / 24);
    return t("expiresInDays", { count: days });
  }

  // Pending request: I'm the proposer
  if (request && request.proposedBy.id === currentUserId) {
    const expires = new Date(request.expiresAt);
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <p className="font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {t("waitingForResponse")}
        </p>

        {/* Wat ik heb ingediend */}
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground shrink-0">{t("reasonLabel")}:</dt>
            <dd className="font-medium text-foreground">{t(`reason.${request.reason}` as never)}</dd>
          </div>
          {request.details && (
            <div>
              <dt className="text-muted-foreground">{t("detailsLabel")}:</dt>
              <dd className="italic text-foreground">&ldquo;{request.details}&rdquo;</dd>
            </div>
          )}
        </dl>

        {/* Wat de wederpartij gaat doen */}
        <p className="mt-2 text-xs text-amber-700/90 dark:text-amber-300/90">
          {t("proposerExplain")}
        </p>

        {/* Countdown */}
        <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400 tabular-nums">
          {formatExpiresIn(expires)}
        </p>
      </div>
    );
  }

  // Pending request: I'm the responder
  if (request) {
    const expires = new Date(request.expiresAt);
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
          {t("incomingRequest", { name: request.proposedBy.displayName })}
        </p>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground shrink-0">{t("reasonLabel")}:</dt>
            <dd className="font-medium text-foreground">{t(`reason.${request.reason}` as never)}</dd>
          </div>
          {request.details && (
            <div>
              <dt className="text-muted-foreground">{t("detailsLabel")}:</dt>
              <dd className="italic text-foreground">&ldquo;{request.details}&rdquo;</dd>
            </div>
          )}
        </dl>

        {/* Countdown + uitleg wat-bij-niet-reageren */}
        <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400 tabular-nums">
          {formatExpiresIn(expires)}
        </p>
        <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/80">
          {t("responderExplain")}
        </p>

        {showRejectForm ? (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder={t("rejectionNotePlaceholder")}
              className="block w-full glass-input px-3 py-2 text-sm text-foreground"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={pending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {t("confirmReject")}
              </button>
              <button
                onClick={() => setShowRejectForm(false)}
                disabled={pending}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleAccept}
              disabled={pending}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {t("acceptCancellation")}
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={pending}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              {t("rejectCancellation")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // No pending request — show request button
  return (
    <>
      <button
        onClick={() => setShowRequestForm((s) => !s)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <Ban className="h-3.5 w-3.5" />
        {t("requestCancellation")}
      </button>

      {showRequestForm && (
        <form
          onSubmit={handleRequest}
          className="mt-3 space-y-2 rounded-lg border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30"
        >
          <p className="text-xs text-muted-foreground">{t("requestExplain")}</p>
          <div>
            <label className="block text-xs font-medium text-foreground">{t("reasonLabel")}</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as CancellationReason)}
              className="mt-1 block w-full glass-input px-3 py-2 text-sm text-foreground"
            >
              {CANCELLATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reason.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground">{t("detailsLabel")}</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              placeholder={t("detailsPlaceholder")}
              className="mt-1 block w-full glass-input px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {pending ? "..." : t("submitRequest")}
            </button>
            <button
              type="button"
              onClick={() => setShowRequestForm(false)}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
