"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitVerification } from "@/actions/verification";
import { ImageUploader } from "@/components/ui/image-uploader";
import { useRefreshOnRealtime } from "@/hooks/use-refresh-on-realtime";

import { LABEL, PILL_RED, SELECT } from "@/components/ploy/tile-styles";
export function VerificationForm() {
  const t = useTranslations("verification");

  // Real-time refresh wanneer admin verificatie goedkeurt/afwijst (Fase 30C)
  useRefreshOnRealtime(["verification-changed"]);
  const [documentType, setDocumentType] = useState("ID_CARD");
  const [frontImageUrl, setFrontImageUrl] = useState("");
  const [backImageUrl, setBackImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const needsBackImage = documentType !== "PASSPORT";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("documentType", documentType);
    formData.set("frontImageUrl", frontImageUrl);
    if (backImageUrl) formData.set("backImageUrl", backImageUrl);

    const result = await submitVerification(formData);
    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="rounded-[14px] bg-[var(--pastel-green)] p-6 text-[var(--pastel-green-ink)]">
        <p className="text-sm">
          {t("submitSuccess")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="dash-card p-5 sm:p-6">
      <h3 className="font-semibold text-foreground">{t("uploadDocuments")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("uploadDescription")}
      </p>

      {error && (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      )}

      {/* Document type selection */}
      <div className="mt-4">
        <label className={LABEL}>
          {t("documentType")}
        </label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className={`mt-1 ${SELECT}`}
        >
          <option value="ID_CARD">{t("idCard")}</option>
          <option value="PASSPORT">{t("passport")}</option>
          <option value="DRIVERS_LICENSE">{t("driversLicense")}</option>
        </select>
      </div>

      {/* Front image */}
      <div className="mt-4">
        <label className={LABEL}>
          {t("frontImage")}
        </label>
        <div className="mt-1">
          <ImageUploader
            images={frontImageUrl ? [frontImageUrl] : []}
            onChange={(imgs) => setFrontImageUrl(imgs[0] || "")}
            maxImages={1}
          />
        </div>
      </div>

      {/* Back image (not for passport) */}
      {needsBackImage && (
        <div className="mt-4">
          <label className={LABEL}>
            {t("backImage")}
          </label>
          <div className="mt-1">
            <ImageUploader
              images={backImageUrl ? [backImageUrl] : []}
              onChange={(imgs) => setBackImageUrl(imgs[0] || "")}
              maxImages={1}
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !frontImageUrl || (needsBackImage && !backImageUrl)}
        className={`mt-6 w-full ${PILL_RED} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {loading ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
