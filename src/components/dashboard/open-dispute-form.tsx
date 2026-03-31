"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { openDispute } from "@/actions/dispute";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { AlertTriangle, Upload, X } from "lucide-react";
import Image from "next/image";

const REASONS = ["NOT_RECEIVED", "NOT_AS_DESCRIBED", "DAMAGED_IN_TRANSIT"] as const;

const REASON_KEYS: Record<string, string> = {
  NOT_RECEIVED: "reasonNotReceived",
  NOT_AS_DESCRIBED: "reasonNotAsDescribed",
  DAMAGED_IN_TRANSIT: "reasonDamagedInTransit",
};

export function OpenDisputeForm({
  bundleId,
  onCancel,
}: {
  bundleId: string;
  onCancel: () => void;
}) {
  const t = useTranslations("disputes");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason || description.length < 20) return;

    setLoading(true);
    const result = await openDispute({
      shippingBundleId: bundleId,
      reason,
      description,
      evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
    });

    if (result?.error === "DISPUTE_TOO_EARLY") {
      toast.error(t("cannotDisputeYet"));
      setLoading(false);
      return;
    }
    if (result?.error === "DISPUTE_EXISTS") {
      toast.error(t("disputeAlreadyExists"));
      setLoading(false);
      return;
    }
    if (result?.error === "DISPUTE_WINDOW_CLOSED") {
      toast.error(t("disputeWindowClosed"));
      setLoading(false);
      return;
    }
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success(t("disputeOpened"));
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t("openDispute")}</p>
      </div>
      <p className="text-xs text-muted-foreground">{t("openDisputeDescription")}</p>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("selectReason")}</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="block w-full glass-input px-3 py-2 text-sm text-foreground"
        >
          <option value="">{t("selectReason")}</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>{t(REASON_KEYS[r])}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("descriptionLabel")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
          rows={3}
          className="block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
        />
      </div>

      {/* Evidence */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("evidenceLabel")}</label>
        <p className="text-xs text-muted-foreground mb-2">{t("evidenceHint")}</p>
        <EvidenceUploader images={evidenceUrls} onChange={setEvidenceUrls} uploading={uploading} setUploading={setUploading} />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || uploading || !reason || description.length < 20}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? t("submitting") : t("submitDispute")}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
        >
          {t("cancelProposal")}
        </button>
      </div>
    </div>
  );
}

function EvidenceUploader({
  images,
  onChange,
  uploading,
  setUploading,
  maxImages = 5,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  maxImages?: number;
}) {
  async function uploadFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const remaining = maxImages - images.length;
    if (remaining <= 0) return;
    const toUpload = fileArray.slice(0, remaining);
    setUploading(true);
    const formData = new FormData();
    toUpload.forEach((f) => formData.append("files", f));
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.urls?.length) onChange([...images, ...data.urls]);
    } catch { /* ignore */ } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((url, i) => (
            <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-lg bg-muted">
              <Image src={url} alt={`Evidence ${i + 1}`} fill className="object-cover" sizes="64px" />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < maxImages && (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          <Upload className="h-4 w-4" />
          {uploading ? "..." : `${images.length}/${maxImages}`}
        </label>
      )}
    </div>
  );
}
