"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { adminReviewVerification } from "@/actions/verification";

interface VerificationRequest {
  id: string;
  documentType: string;
  frontImageUrl: string;
  backImageUrl: string | null;
  createdAt: Date;
  user: {
    id: string;
    displayName: string;
    email: string;
    createdAt: Date;
  };
}

interface AdminVerificationListProps {
  requests: VerificationRequest[];
}

export function AdminVerificationList({ requests }: AdminVerificationListProps) {
  const t = useTranslations("verification");
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDecision = async (requestId: string, decision: "APPROVED" | "REJECTED") => {
    setLoading(true);
    const result = await adminReviewVerification(
      requestId,
      decision,
      decision === "REJECTED" ? rejectReason : undefined
    );
    setLoading(false);

    if (result?.success) {
      setProcessedIds((prev) => new Set([...prev, requestId]));
      setExpandedId(null);
      setRejectReason("");
    }
  };

  const pending = requests.filter((r) => !processedIds.has(r.id));

  if (pending.length === 0) {
    return (
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        {t("noPendingRequests")}
      </p>
    );
  }

  const documentTypeLabel = (type: string) => {
    switch (type) {
      case "ID_CARD": return t("idCard");
      case "PASSPORT": return t("passport");
      case "DRIVERS_LICENSE": return t("driversLicense");
      default: return type;
    }
  };

  return (
    <div className="mt-6 space-y-4">
      {pending.map((request) => (
        <div
          key={request.id}
          className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {request.user.displayName}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {request.user.email}
              </p>
              <div className="mt-1 flex gap-3 text-xs text-zinc-400">
                <span>{documentTypeLabel(request.documentType)}</span>
                <span>{t("submittedOn")} {new Date(request.createdAt).toLocaleDateString("nl-NL")}</span>
                <span>{t("memberSince")} {new Date(request.user.createdAt).toLocaleDateString("nl-NL")}</span>
              </div>
            </div>
            <button
              onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              {expandedId === request.id ? t("collapse") : t("review")}
            </button>
          </div>

          {expandedId === request.id && (
            <div className="mt-4 space-y-4">
              {/* Document images */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("frontImage")}</p>
                  <img
                    src={request.frontImageUrl}
                    alt="Document front"
                    className="max-h-64 rounded-md border border-zinc-200 object-contain dark:border-zinc-700"
                  />
                </div>
                {request.backImageUrl && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("backImage")}</p>
                    <img
                      src={request.backImageUrl}
                      alt="Document back"
                      className="max-h-64 rounded-md border border-zinc-200 object-contain dark:border-zinc-700"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-end gap-3">
                <button
                  onClick={() => handleDecision(request.id, "APPROVED")}
                  disabled={loading}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {t("approve")}
                </button>

                <div className="flex-1">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t("rejectReasonLabel")}</label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={t("rejectReasonPlaceholder")}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>

                <button
                  onClick={() => handleDecision(request.id, "REJECTED")}
                  disabled={loading}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {t("reject")}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
