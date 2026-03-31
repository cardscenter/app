"use client";

import { useState } from "react";
import { HandCoins, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createProposal } from "@/actions/proposal";
import { useRouter } from "next/navigation";

interface ProposalButtonProps {
  conversationId: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number | null;
  isSeller: boolean;
}

export function ProposalButton({
  conversationId,
  listingTitle,
  listingPrice,
  isSeller,
}: ProposalButtonProps) {
  const t = useTranslations("proposal");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(listingPrice?.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(t("enterAmount"));
      setLoading(false);
      return;
    }

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-muted-foreground hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
        title={isSeller ? t("suggestPrice") : t("makeOffer")}
      >
        <HandCoins className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass w-full max-w-md rounded-2xl p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {isSeller ? t("suggestPrice") : t("makeOffer")}
              </h3>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4 truncate">
              {t("proposalFor", { title: listingTitle })}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("amount")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="glass-input w-full pl-8 pr-4 py-2.5 text-sm text-foreground"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? "..." : t("submit")}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
