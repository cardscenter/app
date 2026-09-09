"use client";

import { contactSeller } from "@/actions/message";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

export function ContactSellerButton({
  sellerId,
  auctionId,
  claimsaleId,
  listingId,
  label,
  variant = "outline",
  className,
}: {
  sellerId: string;
  auctionId?: string;
  claimsaleId?: string;
  listingId?: string;
  // Optionele override voor de knop-tekst — gebruikt op de listing-detail page
  // om "Bod doen" / "Vraag richtprijs" / "Ruilvoorstel doen" te tonen i.p.v.
  // de generieke "Contact verkoper".
  label?: string;
  // "outline" (default) — secundaire stijl; "primary" — donker/primary voor
  // wanneer dit de voornaamste actie is (bv. NEGOTIABLE zonder direct-buy).
  variant?: "outline" | "primary";
  // Profiel-redesign (sept 2026): volledige klassen-override voor de
  // pil-knop in de profielkop ("Bericht sturen").
  className?: string;
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContact() {
    setLoading(true);
    setError(null);
    const result = await contactSeller(sellerId, auctionId, claimsaleId, listingId);
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
    } else if (result.conversationId) {
      router.push(`/berichten/${result.conversationId}`);
    }
  }

  const buttonClass = className
    ? className
    : variant === "primary"
      ? "w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md hover:bg-primary-hover disabled:opacity-50 transition-all"
      : "w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground border border-border bg-card hover:bg-muted disabled:opacity-50 transition-all";

  return (
    <div>
      <button
        onClick={handleContact}
        disabled={loading}
        className={buttonClass}
      >
        {label ?? t("contactSeller")}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
