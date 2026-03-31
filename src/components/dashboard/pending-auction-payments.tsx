"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { completeAuctionPayment } from "@/actions/auction";

interface PendingAuction {
  id: string;
  title: string;
  finalPrice: number | null;
  paymentDeadline: Date | null;
}

interface PendingAuctionPaymentsProps {
  auctions: PendingAuction[];
}

export function PendingAuctionPayments({ auctions }: PendingAuctionPaymentsProps) {
  const t = useTranslations("wallet");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());

  const handlePay = async (auctionId: string) => {
    setLoadingId(auctionId);
    setError(null);
    const result = await completeAuctionPayment(auctionId);
    setLoadingId(null);
    if (result?.error) {
      setError(result.error);
    } else {
      setPaidIds((prev) => new Set([...prev, auctionId]));
    }
  };

  const remaining = auctions.filter((a) => !paidIds.has(a.id));
  if (remaining.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-800 dark:bg-red-900/10">
      <h3 className="font-semibold text-red-700 dark:text-red-400">
        {t("pendingPayments")}
      </h3>
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
        {t("pendingPaymentsDescription")}
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-3 space-y-2">
        {remaining.map((auction) => (
          <div
            key={auction.id}
            className="flex items-center justify-between rounded-md bg-white px-4 py-3 dark:bg-zinc-900"
          >
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {auction.title}
              </p>
              <div className="flex gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span>&euro;{auction.finalPrice?.toFixed(2)}</span>
                {auction.paymentDeadline && (
                  <span>
                    {t("deadline")}: {new Date(auction.paymentDeadline).toLocaleDateString("nl-NL")}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handlePay(auction.id)}
              disabled={loadingId === auction.id}
              className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loadingId === auction.id ? "..." : t("payNow")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
