"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cancelAuction } from "@/actions/auction";
import { Trash2 } from "lucide-react";

interface Props {
  auctionId: string;
  bidCount: number;
  status: string;
  /** "card" voor compacte knop in dashboard-rij, "panel" voor volledige knop op detail-page. */
  variant?: "card" | "panel";
}

// Fase 27.88: eigenaar van een ACTIVE veiling zonder biedingen kan deze
// annuleren. Bij ≥1 bid verdwijnt de knop — daar zit de seller aan vast.
export function AuctionOwnerActions({ auctionId, bidCount, status, variant = "panel" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Conditie: alleen ACTIVE + 0 biedingen mag annuleren.
  if (status !== "ACTIVE" || bidCount > 0) return null;

  const handleCancel = () => {
    if (!confirm("Weet je zeker dat je deze veiling wilt annuleren? Dit kan niet ongedaan worden gemaakt.")) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelAuction(auctionId);
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
        if (variant === "panel") {
          // Op de detail-page is de veiling daarna CANCELLED — terug naar dashboard.
          router.push("/dashboard/veilingen");
        }
      }
    });
  };

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleCancel();
        }}
        disabled={pending}
        title="Veiling annuleren"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-300 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <Trash2 className="h-4 w-4" />
        {pending ? "Bezig..." : "Veiling annuleren"}
      </button>
      <p className="text-xs text-muted-foreground">
        Annuleren kan zolang er nog geen bod is uitgebracht.
      </p>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
