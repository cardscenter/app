"use client";

import { useTranslations } from "next-intl";
import { updateListingStatus } from "@/actions/listing";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ListingActions({ listingId }: { listingId: string }) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(status: "SOLD" | "DELETED") {
    setLoading(true);
    const result = await updateListingStatus(listingId, status);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => handleAction("SOLD")}
        disabled={loading}
        className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-green-700 disabled:opacity-50"
      >
        {t("markSold")}
      </button>
      <button
        onClick={() => handleAction("DELETED")}
        disabled={loading}
        className="w-full rounded-xl border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
      >
        {t("deleteListing")}
      </button>
    </div>
  );
}
