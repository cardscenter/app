"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { respondToProposal, completeProposalPayment, getProposalBalanceInfo } from "@/actions/proposal";
import { HandCoins, Check, X, Clock, AlertTriangle, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";

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
  const [showConfirm, setShowConfirm] = useState(false);
  const [balanceInfo, setBalanceInfo] = useState<{
    totalCost: number;
    shippingCost: number;
    availableBalance: number;
    hasSufficientBalance: boolean;
  } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const isProposer = proposal.proposerId === currentUserId;
  const canRespond = proposal.status === "PENDING" && !isProposer;
  const canPay = proposal.status === "ACCEPTED" && proposal.paymentStatus === "AWAITING_PAYMENT" && !isProposer;

  const remainingDays = proposal.paymentDeadline
    ? Math.max(0, Math.ceil((new Date(proposal.paymentDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  async function handleAcceptClick() {
    setLoadingBalance(true);
    setError(null);
    const result = await getProposalBalanceInfo(proposal.id);
    if ("error" in result) {
      setError(result.error!);
      setLoadingBalance(false);
      return;
    }
    setBalanceInfo(result as { totalCost: number; shippingCost: number; availableBalance: number; hasSufficientBalance: boolean });
    setLoadingBalance(false);
    setShowConfirm(true);
  }

  async function handleConfirmAccept() {
    setLoading(true);
    setError(null);
    const result = await respondToProposal(proposal.id, "ACCEPT");
    if (result.error) {
      setError(result.error);
    }
    setShowConfirm(false);
    setLoading(false);
    router.refresh();
  }

  async function handleReject() {
    setLoading(true);
    setError(null);
    const result = await respondToProposal(proposal.id, "REJECT");
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
    proposal.status === "WITHDRAWN" ? "text-muted-foreground" :
    "text-yellow-600 dark:text-yellow-400";

  const statusIcon =
    proposal.status === "ACCEPTED" ? <Check className="h-4 w-4" /> :
    proposal.status === "REJECTED" ? <X className="h-4 w-4" /> :
    proposal.status === "WITHDRAWN" ? <X className="h-4 w-4" /> :
    <Clock className="h-4 w-4" />;

  return (
    <>
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
            {proposal.status === "WITHDRAWN" && t("withdrawn")}
          </div>

          {/* Awaiting payment info */}
          {proposal.paymentStatus === "AWAITING_PAYMENT" && remainingDays !== null && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
              {t("awaitingPayment", { days: remainingDays.toString() })}
            </p>
          )}

          {proposal.paymentStatus === "PAYMENT_FAILED" && (
            <p className="text-xs text-red-500 mb-2">
              {t("paymentExpired")}
            </p>
          )}

          {proposal.paymentStatus === "PAID" && (
            <p className="text-xs text-green-600 dark:text-green-400 mb-2">
              {t("paymentComplete")}
            </p>
          )}

          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

          {/* Action buttons */}
          {canRespond && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAcceptClick}
                disabled={loading || loadingBalance}
                className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {loadingBalance ? "..." : t("accept")}
              </button>
              <button
                onClick={handleReject}
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

      {/* Accept confirmation popup */}
      {showConfirm && balanceInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
          <div className="glass w-full max-w-md rounded-2xl p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {t("confirmAccept")}
              </h3>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Amount breakdown */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("amount")}</span>
                <span className="font-medium text-foreground">&euro;{proposal.amount.toFixed(2)}</span>
              </div>
              {balanceInfo.shippingCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("shippingCost")}</span>
                  <span className="font-medium text-foreground">&euro;{balanceInfo.shippingCost.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                <span className="text-foreground">{t("total")}</span>
                <span className="text-foreground">&euro;{balanceInfo.totalCost.toFixed(2)}</span>
              </div>
            </div>

            {/* Balance info */}
            <div className="flex items-center gap-2 mb-4 text-sm">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("yourBalance")}:</span>
              <span className="font-medium text-foreground">&euro;{balanceInfo.availableBalance.toFixed(2)}</span>
            </div>

            {/* Sufficient balance message */}
            {balanceInfo.hasSufficientBalance ? (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 mb-4">
                <p className="text-sm text-green-700 dark:text-green-400 flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {t("balanceSufficient")}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 mb-4">
                <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {t("balanceInsufficient")}
                </p>
                <Link
                  href="/dashboard/saldo"
                  className="mt-2 inline-block text-xs font-medium text-amber-700 dark:text-amber-400 underline hover:no-underline"
                >
                  {t("topUpBalance")}
                </Link>
              </div>
            )}

            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

            {/* Confirm buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleConfirmAccept}
                disabled={loading}
                className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "..." : t("confirmAcceptButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
