"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { MessageCircle } from "lucide-react";
import { contactSeller } from "@/actions/message";

interface Props {
  sellerId: string;
  buyerId: string;
  listingId: string | null;
  conversationId: string | null;
  perspective: "buyer" | "seller";
  label?: string;
  icon?: ReactNode;
}

// Universal chat-knop voor pickup-bundles in /aankopen en /verkopen.
// Als er al een conversation is (bundle-offer): navigeer daarheen.
// Anders: contactSeller maakt of vindt een conversation per (buyer, seller, listing)
// — buyer-only flow. Voor seller zonder bestaande conversation: error "open chat
// vanuit /berichten" (seller kan niet zelf een nieuwe conversation starten via
// dit pad — dat is een buyer-initiated flow).
export function OpenPickupChatButton({
  sellerId,
  buyerId,
  listingId,
  conversationId,
  perspective,
  label,
  icon,
}: Props) {
  const t = useTranslations("pickup");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (conversationId) {
      router.push(`/berichten/${conversationId}`);
      return;
    }
    if (perspective === "seller") {
      // Seller kan niet zelf contactSeller aanroepen voor een buyer
      setError(t("noConversationSeller"));
      return;
    }
    // Buyer-pad: maak/vind conversation
    setError(null);
    startTransition(async () => {
      const result = await contactSeller(sellerId, undefined, undefined, listingId ?? undefined);
      if ("error" in result) {
        setError(result.error);
      } else if (result.conversationId) {
        router.push(`/berichten/${result.conversationId}`);
      }
      // Suppress unused buyerId warning — we keep the prop for future symmetry
      void buyerId;
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        {icon ?? <MessageCircle className="h-4 w-4" />}
        {label ?? t("openChat")}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
