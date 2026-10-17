"use client";

import { useState } from "react";
import { submitAddressVerification } from "@/actions/verification";
import { ImageUploader } from "@/components/ui/image-uploader";
import { useRefreshOnRealtime } from "@/hooks/use-refresh-on-realtime";

import { LABEL, PILL_RED, SELECT } from "@/components/ploy/tile-styles";
const ADDRESS_DOCUMENT_LABELS: Record<string, string> = {
  TAX_LETTER: "Belastingdienst-brief",
  UTILITY_BILL: "Energie- of waterrekening",
  BANK_STATEMENT: "Bankafschrift met adres",
  MUNICIPAL_LETTER: "Gemeente-correspondentie",
};

export function AddressVerificationForm() {
  // Real-time refresh wanneer admin adres-verificatie behandelt.
  useRefreshOnRealtime(["verification-changed"]);

  const [addressDocumentType, setAddressDocumentType] = useState("UTILITY_BILL");
  const [frontImageUrl, setFrontImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("addressDocumentType", addressDocumentType);
    formData.set("frontImageUrl", frontImageUrl);

    const result = await submitAddressVerification(formData);
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
          Aanvraag ingediend. We laten je weten zodra de admin je adres heeft gecontroleerd.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="dash-card p-5 sm:p-6">
      <h3 className="font-semibold text-foreground">Adres-document uploaden</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload een officieel document waarop je naam én adres zichtbaar zijn (max 3 maanden oud). De
        admin vergelijkt het met je profiel-gegevens.
      </p>

      {error && (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      )}

      <div className="mt-4">
        <label className={LABEL}>Documenttype</label>
        <select
          value={addressDocumentType}
          onChange={(e) => setAddressDocumentType(e.target.value)}
          className={`mt-1 ${SELECT}`}
        >
          {Object.entries(ADDRESS_DOCUMENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className={LABEL}>Document-foto</label>
        <div className="mt-1">
          <ImageUploader
            images={frontImageUrl ? [frontImageUrl] : []}
            onChange={(imgs) => setFrontImageUrl(imgs[0] || "")}
            maxImages={1}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !frontImageUrl}
        className={`mt-6 w-full ${PILL_RED} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {loading ? "Versturen..." : "Verstuur aanvraag"}
      </button>
    </form>
  );
}
