"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { adminReviewVerification } from "@/actions/verification";
import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { PILL_BTN, PILL_RED, PILL_INK, INPUT, LABEL } from "@/components/ploy/tile-styles";

interface VerificationRequest {
  id: string;
  type: string; // "ID" | "ADDRESS" — Fase 32
  documentType: string | null;
  addressDocumentType: string | null;
  frontImageUrl: string;
  backImageUrl: string | null;
  createdAt: Date;
  user: {
    id: string;
    displayName: string;
    email: string;
    createdAt: Date;
    street?: string | null;
    houseNumber?: string | null;
    postalCode?: string | null;
    city?: string | null;
  };
}

const ADDRESS_DOCUMENT_LABELS: Record<string, string> = {
  TAX_LETTER: "Belastingdienst-brief",
  UTILITY_BILL: "Energie-/waterrekening",
  BANK_STATEMENT: "Bankafschrift",
  MUNICIPAL_LETTER: "Gemeentebrief",
};

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
      <div className="mt-6">
        <EmptyState icon={ShieldCheck} title={t("noPendingRequests")} compact />
      </div>
    );
  }

  const documentTypeLabel = (request: VerificationRequest) => {
    if (request.type === "ADDRESS" && request.addressDocumentType) {
      return ADDRESS_DOCUMENT_LABELS[request.addressDocumentType] ?? request.addressDocumentType;
    }
    switch (request.documentType) {
      case "ID_CARD": return t("idCard");
      case "PASSPORT": return t("passport");
      case "DRIVERS_LICENSE": return t("driversLicense");
      default: return request.documentType ?? "-";
    }
  };

  const formatAddress = (u: VerificationRequest["user"]) => {
    const parts = [
      u.street && u.houseNumber ? `${u.street} ${u.houseNumber}` : u.street,
      u.postalCode && u.city ? `${u.postalCode} ${u.city}` : u.city,
    ].filter(Boolean);
    return parts.join(", ");
  };

  return (
    <div className="mt-6 space-y-4">
      {pending.map((request) => (
        <div
          key={request.id}
          className="dash-card p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">
                {request.user.displayName}
              </p>
              <p className="text-sm text-muted-foreground">
                {request.user.email}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge tone={request.type === "ADDRESS" ? "primary" : "info"}>
                  {request.type === "ADDRESS" ? "Adres" : "ID"}
                </StatusBadge>
                <span>{documentTypeLabel(request)}</span>
                <span>{t("submittedOn")} {new Date(request.createdAt).toLocaleDateString("nl-NL")}</span>
                <span>{t("memberSince")} {new Date(request.user.createdAt).toLocaleDateString("nl-NL")}</span>
              </div>
              {request.type === "ADDRESS" && formatAddress(request.user) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Profiel-adres: <span className="font-medium text-foreground">{formatAddress(request.user)}</span>
                </p>
              )}
            </div>
            <button
              onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
              className={`${PILL_BTN} shrink-0`}
            >
              {expandedId === request.id ? t("collapse") : t("review")}
            </button>
          </div>

          {expandedId === request.id && (
            <div className="mt-4 space-y-4">
              {/* Document images */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("frontImage")}</p>
                  <img
                    src={request.frontImageUrl}
                    alt="Document front"
                    className="max-h-64 rounded-[12px] border border-border object-contain"
                  />
                </div>
                {request.backImageUrl && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{t("backImage")}</p>
                    <img
                      src={request.backImageUrl}
                      alt="Document back"
                      className="max-h-64 rounded-[12px] border border-border object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-end gap-3">
                <button
                  onClick={() => handleDecision(request.id, "APPROVED")}
                  disabled={loading}
                  className={`${PILL_INK} disabled:opacity-50`}
                >
                  {t("approve")}
                </button>

                <div className="flex-1">
                  <label className={LABEL}>{t("rejectReasonLabel")}</label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={t("rejectReasonPlaceholder")}
                    className={INPUT}
                  />
                </div>

                <button
                  onClick={() => handleDecision(request.id, "REJECTED")}
                  disabled={loading}
                  className={`${PILL_RED} disabled:opacity-50`}
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
