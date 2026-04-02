"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { markAsShipped } from "@/actions/purchase";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Truck, Link as LinkIcon } from "lucide-react";

export function ShipBundleForm({ bundleId }: { bundleId: string }) {
  const t = useTranslations("sellerClaims");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    setLoading(true);
    const result = await markAsShipped(bundleId, trackingUrl);

    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success(t("markedAsShipped"));
    router.refresh();
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        <Truck className="h-4 w-4" />
        {t("markAsShipped")}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`tracking-${bundleId}`} className="block text-sm font-medium text-foreground">
          {t("trackingUrl")}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            id={`tracking-${bundleId}`}
            type="url"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder={t("trackingUrlPlaceholder")}
            className="block w-full glass-input px-3 py-2 text-sm text-foreground"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("trackingUrlHint")}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || !trackingUrl.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <Truck className="h-4 w-4" />
          {loading ? "..." : t("confirmShipped")}
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
