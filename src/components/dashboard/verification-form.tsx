"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitVerification } from "@/actions/verification";
import { ImageUploader } from "@/components/ui/image-uploader";

export function VerificationForm() {
  const t = useTranslations("verification");
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
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/10">
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("submitSuccess")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-6">
      <h3 className="font-semibold text-foreground">{t("uploadDocuments")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("uploadDescription")}
      </p>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Document type selection */}
      <div className="mt-4">
        <label className="text-sm font-medium text-foreground">
          {t("documentType")}
        </label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="mt-1 block w-full rounded-md glass-input px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ID_CARD">{t("idCard")}</option>
          <option value="PASSPORT">{t("passport")}</option>
          <option value="DRIVERS_LICENSE">{t("driversLicense")}</option>
        </select>
      </div>

      {/* Front image */}
      <div className="mt-4">
        <label className="text-sm font-medium text-foreground">
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
          <label className="text-sm font-medium text-foreground">
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
        className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
