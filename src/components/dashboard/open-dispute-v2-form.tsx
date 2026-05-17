"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { openDisputeV2 } from "@/actions/dispute-v2";
import {
  DISPUTE_V2_REASON_CATEGORIES,
  type DisputeV2ReasonCategory,
} from "@/lib/dispute-v2/config";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { AlertTriangle, Upload, X } from "lucide-react";
import Image from "next/image";

const REASON_KEYS: Record<DisputeV2ReasonCategory, string> = {
  NOT_RECEIVED: "reasonNotReceivedV2",
  NOT_AS_DESCRIBED: "reasonNotAsDescribedV2",
  DAMAGED: "reasonDamagedV2",
  WRONG_ITEM: "reasonWrongItemV2",
  COUNTERFEIT_SUSPECTED: "reasonCounterfeitV2",
  OTHER: "reasonOtherV2",
};

export function OpenDisputeV2Form({
  bundleId,
  onCancel,
}: {
  bundleId: string;
  onCancel: () => void;
}) {
  const t = useTranslations("disputes");
  const router = useRouter();
  const [reasonCategory, setReasonCategory] = useState<DisputeV2ReasonCategory | "">("");
  const [statement, setStatement] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reasonCategory || statement.length < 20) return;

    setLoading(true);
    const result = await openDisputeV2({
      bundleId,
      reasonCategory,
      buyerStatement: statement,
      evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
    });

    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success(t("disputeOpened"));
    if (result.disputeId) {
      router.push(`/dashboard/geschillen-v2/${result.disputeId}`);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t("openDispute")}</p>
      </div>
      <p className="text-xs text-muted-foreground">{t("openDisputeDescriptionV2")}</p>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("selectReason")}</label>
        <select
          value={reasonCategory}
          onChange={(e) => setReasonCategory(e.target.value as DisputeV2ReasonCategory)}
          className="block w-full glass-input px-3 py-2 text-sm text-foreground"
        >
          <option value="">{t("selectReason")}</option>
          {DISPUTE_V2_REASON_CATEGORIES.map((r) => (
            <option key={r} value={r}>{t(REASON_KEYS[r])}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("descriptionLabel")}</label>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder={t("descriptionPlaceholderV2")}
          rows={4}
          className="block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {statement.length}/20 minimaal
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("evidenceLabel")}</label>
        <p className="text-xs text-muted-foreground mb-2">{t("evidenceHintV2")}</p>
        <EvidenceUploader
          images={evidenceUrls}
          onChange={setEvidenceUrls}
          uploading={uploading}
          setUploading={setUploading}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || uploading || !reasonCategory || statement.length < 20}
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
  maxImages = 6,
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
    formData.append("context", "dispute"); // Fase 40 — moderation pad
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.urls?.length) onChange([...images, ...data.urls]);
      if (data.errors?.length) {
        for (const err of data.errors) toast.error(err);
      }
    } catch {
      toast.error("Upload mislukt");
    } finally {
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
