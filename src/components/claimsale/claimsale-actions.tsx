"use client";

import { useTranslations } from "next-intl";
import { publishClaimsale, deleteClaimsale } from "@/actions/claimsale";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimsaleActions({ claimsaleId, status }: { claimsaleId: string; status: string }) {
  const t = useTranslations("claimsale");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    if (!confirm(t("confirmPublish"))) return;
    setLoading(true);
    const result = await publishClaimsale(claimsaleId);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Weet je zeker dat je deze claimsale wilt verwijderen?")) return;
    setLoading(true);
    const result = await deleteClaimsale(claimsaleId);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      {error && <p className="text-sm text-red-500">{error}</p>}
      {status === "DRAFT" && (
        <button
          onClick={handlePublish}
          disabled={loading}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {t("publish")}
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
      >
        {tc("delete")}
      </button>
    </div>
  );
}
