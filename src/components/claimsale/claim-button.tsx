"use client";

import { useTranslations } from "next-intl";
import { claimItem } from "@/actions/claimsale";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimButton({ itemId }: { itemId: string }) {
  const t = useTranslations("claimsale");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    setLoading(true);
    setError(null);
    const result = await claimItem(itemId);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={handleClaim}
        disabled={loading}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
      >
        {loading ? "..." : t("claim")}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
