"use client";

import { contactSeller } from "@/actions/message";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

export function ContactSellerButton({
  sellerId,
  auctionId,
  claimsaleId,
  listingId,
}: {
  sellerId: string;
  auctionId?: string;
  claimsaleId?: string;
  listingId?: string;
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContact() {
    setLoading(true);
    setError(null);
    const result = await contactSeller(sellerId, auctionId, claimsaleId, listingId);
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
    } else if (result.conversationId) {
      router.push(`/berichten/${result.conversationId}`);
    }
  }

  return (
    <div>
      <button
        onClick={handleContact}
        disabled={loading}
        className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground glass-subtle hover:bg-white/60 dark:hover:bg-white/10 disabled:opacity-50 transition-all"
      >
        {t("contactSeller")}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
