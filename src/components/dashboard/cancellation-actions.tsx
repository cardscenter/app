"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import {
  requestCancellation,
  respondToCancellation,
  getActiveCancellationRequest,
  CANCELLATION_REASONS,
  type CancellationReason,
} from "@/actions/cancellation";

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
  const [reason, setReason] = useState<CancellationReason>("BUYER_CHANGED_MIND");
  const [details, setDetails] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");

  useEffect(() => {
    if (bundleStatus !== "PAID") {
      setLoading(false);
      return;
    }
    getActiveCancellationRequest(bundleId).then((r) => {
      if (r) {
        setRequest({
          id: r.id,
          reason: r.reason,
          details: r.details,
          expiresAt: r.expiresAt.toISOString(),
          proposedBy: r.proposedBy,
        });
      }
      setLoading(false);
    });
  }, [bundleId, bundleStatus]);

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
      router.refresh();
    });
  }

  // Pending request: I'm the proposer
  if (request && request.proposedBy.id === currentUserId) {
    const expires = new Date(request.expiresAt);
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <p className="font-medium text-amber-700 dark:text-amber-300">{t("waitingForResponse")}</p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t("expiresOn", { date: expires.toLocaleDateString("nl-NL") })}
        </p>
      </div>
    );
  }

  // Pending request: I'm the responder
  if (request) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
          {t("incomingRequest", { name: request.proposedBy.displayName })}
        </p>
        <p className="mt-1 text-xs text-foreground">
          {t("reasonLabel")}: {t(`reason.${request.reason}` as never)}
        </p>
        {request.details && <p className="mt-1 text-xs text-muted-foreground">{request.details}</p>}

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
