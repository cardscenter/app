"use client";

import { useState } from "react";
import { HandCoins, X, Wallet, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { createProposal } from "@/actions/proposal";
import { useRouter } from "next/navigation";

interface ProposalButtonProps {
  conversationId: string;
  listingTitle?: string;
  listingPrice?: number | null;
  isSeller: boolean;
  availableBalance?: number;
}

export function ProposalButton({
  conversationId,
  listingTitle,
  listingPrice,
  isSeller,
  availableBalance,
}: ProposalButtonProps) {
  const t = useTranslations("proposal");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(listingPrice?.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(t("enterAmount"));
      return;
    }

    setLoading(true);
    const result = await createProposal(
      conversationId,
      parsedAmount,
      isSeller ? "SELL" : "BUY"
    );

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setOpen(false);
    setAmount(listingPrice?.toString() ?? "");
    setLoading(false);
    router.refresh();
  }

  const title = isSeller ? t("suggestPrice") : t("makeOffer");
  const overBudget =
    !isSeller &&
    availableBalance !== undefined &&
    parseFloat(amount) > availableBalance &&
    parseFloat(amount) > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        title={title}
      >
        <HandCoins className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
          <div
            className="glass max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {listingTitle && (
              <p className="mb-5 truncate text-sm text-muted-foreground">
                {t("proposalFor", { title: listingTitle })}
              </p>
            )}

            {/* Amount */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-foreground">
                {t("amount")}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground"
                />
              </div>
            </div>

            {/* Balance info (buyer only) */}
            {!isSeller && availableBalance !== undefined && (
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t("yourBalance")}:</span>
                <span className="ml-auto font-medium text-foreground">
                  €{availableBalance.toFixed(2)}
                </span>
              </div>
            )}

            {/* Over-budget warning */}
            {overBudget && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {t("balanceInsufficient")}
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !amount}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? "..." : t("submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
