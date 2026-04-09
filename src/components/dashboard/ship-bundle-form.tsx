"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { markAsShipped } from "@/actions/purchase";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Truck, Hash, Camera, X, AlertTriangle } from "lucide-react";
import { getCarrierById, looksLikeUrl } from "@/lib/shipping/carriers";

interface ShipBundleFormProps {
  bundleId: string;
  isBriefpost?: boolean;
  carrierId?: string | null;
  buyerCountry?: string | null;
  buyerPostalCode?: string | null;
}

export function ShipBundleForm({
  bundleId,
  isBriefpost = false,
  carrierId,
  buyerCountry,
  buyerPostalCode,
}: ShipBundleFormProps) {
  const t = useTranslations("sellerClaims");
  const ts = useTranslations("shipping");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [proofUrls, setProofUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  const carrier = carrierId ? getCarrierById(carrierId) : null;
  const showUrlWarning = looksLikeUrl(trackingNumber);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          setProofUrls((prev) => [...prev, data.url]);
        }
      } catch {
        toast.error("Upload mislukt");
      }
    }
    setUploading(false);
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setProofUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setLoading(true);

    if (isBriefpost && proofUrls.length === 0) {
      toast.error(ts("proofRequired"));
      setLoading(false);
      return;
    }

    if (!isBriefpost && !trackingNumber.trim()) {
      toast.error(ts("trackingNumberRequired"));
      setLoading(false);
      return;
    }

    if (showUrlWarning) {
      toast.error(ts("trackingNumberNotUrl"));
      setLoading(false);
      return;
    }

    const result = await markAsShipped(
      bundleId,
      trackingNumber.trim(),
      proofUrls.length > 0 ? proofUrls : undefined,
      carrierId ?? undefined,
      buyerCountry ?? undefined,
      buyerPostalCode ?? undefined,
    );

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
      {/* Briefpost warning */}
      {isBriefpost && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{ts("proofPhotosHintBriefpost")}</span>
        </div>
      )}

      {/* Tracking number — required for tracked, hidden for briefpost */}
      {!isBriefpost && (
        <div>
          <label htmlFor={`tracking-${bundleId}`} className="block text-sm font-medium text-foreground">
            {ts("trackingNumber")} {carrier && <span className="text-muted-foreground font-normal">({carrier.name})</span>}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              id={`tracking-${bundleId}`}
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder={carrier?.trackingNumberPlaceholder ?? ts("trackingNumberPlaceholder")}
              className="block w-full glass-input px-3 py-2 text-sm text-foreground"
            />
          </div>
          {showUrlWarning && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{ts("trackingNumberNotUrl")}</p>
          )}
          {!showUrlWarning && (
            <p className="mt-1 text-xs text-muted-foreground">{ts("trackingNumberHint")}</p>
          )}
        </div>
      )}

      {/* Proof photos */}
      <div>
        <label className="block text-sm font-medium text-foreground">
          {ts("proofPhotos")} {isBriefpost ? <span className="text-red-500">*</span> : <span className="text-muted-foreground font-normal">({ts("optional")})</span>}
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isBriefpost ? ts("proofPhotosHintBriefpost") : ts("proofPhotosHintTracked")}
        </p>

        {/* Photo grid */}
        {proofUrls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {proofUrls.map((url, i) => (
              <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                <img src={url} alt={`Bewijs ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white shadow-sm hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50">
          <Camera className="h-4 w-4" />
          {uploading ? "..." : ts("addPhoto")}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            disabled={uploading}
            className="sr-only"
          />
        </label>
      </div>

      {/* Submit */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || showUrlWarning || (isBriefpost ? proofUrls.length === 0 : !trackingNumber.trim())}
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
