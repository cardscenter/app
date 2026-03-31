"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { respondToProposal, completeProposalPayment } from "@/actions/proposal";
import { HandCoins, Check, X, Clock } from "lucide-react";

interface ProposalData {
  id: string;
  amount: number;
  type: string;
  status: string;
  proposerId: string;
  paymentStatus?: string | null;
  paymentDeadline?: string | null;
}

interface ProposalMessageProps {
  proposal: ProposalData;
  currentUserId: string;
  conversationId: string;
  isOwn: boolean;
}

export function ProposalMessage({ proposal, currentUserId, conversationId, isOwn }: ProposalMessageProps) {
  const t = useTranslations("proposal");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProposer = proposal.proposerId === currentUserId;
  const canRespond = proposal.status === "PENDING" && !isProposer;
  const canPay = proposal.status === "ACCEPTED" && proposal.paymentStatus === "AWAITING_PAYMENT" && !isProposer;

  // Calculate remaining days for payment deadline
  const remainingDays = proposal.paymentDeadline
    ? Math.max(0, Math.ceil((new Date(proposal.paymentDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  async function handleRespond(action: "ACCEPT" | "REJECT") {
    setLoading(true);
    setError(null);
    const result = await respondToProposal(proposal.id, action);
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
    router.refresh();
  }

  async function handlePayment() {
    setLoading(true);
    setError(null);
    const result = await completeProposalPayment(proposal.id);
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
    router.refresh();
  }

  const statusColor =
    proposal.status === "ACCEPTED" ? "text-green-600 dark:text-green-400" :
    proposal.status === "REJECTED" ? "text-red-500" :
    "text-yellow-600 dark:text-yellow-400";

  const statusIcon =
    proposal.status === "ACCEPTED" ? <Check className="h-4 w-4" /> :
    proposal.status === "REJECTED" ? <X className="h-4 w-4" /> :
    <Clock className="h-4 w-4" />;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%] rounded-xl border border-border bg-white/80 dark:bg-white/5 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <HandCoins className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {proposal.type === "BUY" ? t("makeOffer") : t("suggestPrice")}
          </span>
        </div>

        <div className="text-2xl font-bold text-foreground mb-2">
          &euro;{proposal.amount.toFixed(2)}
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1.5 text-sm font-medium mb-2 ${statusColor}`}>
          {statusIcon}
          {proposal.status === "PENDING" && t("pending")}
          {proposal.status === "ACCEPTED" && t("accepted")}
          {proposal.status === "REJECTED" && t("rejected")}
        </div>

        {/* Awaiting payment info */}
        {proposal.paymentStatus === "AWAITING_PAYMENT" && remainingDays !== null && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
            {t("awaitingPayment", { days: remainingDays.toString() })}
          </p>
        )}

        {proposal.paymentStatus === "PAYMENT_FAILED" && (
          <p className="text-xs text-red-500 mb-2">
            Betaling verlopen
          </p>
        )}

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        {/* Action buttons */}
        {canRespond && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handleRespond("ACCEPT")}
              disabled={loading}
              className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {t("accept")}
            </button>
            <button
              onClick={() => handleRespond("REJECT")}
              disabled={loading}
              className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {t("reject")}
            </button>
          </div>
        )}

        {/* Complete payment button */}
        {canPay && (
          <button
            onClick={handlePayment}
            disabled={loading}
            className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {t("completePayment")}
          </button>
        )}
      </div>
    </div>
  );
}
