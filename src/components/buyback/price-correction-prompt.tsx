"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, X } from "lucide-react";
import { respondToPriceCorrection } from "@/actions/buyback";

interface PriceCorrectionPromptProps {
  itemId: string;
  cardName: string;
  originalBuybackPrice: number;
  correctedMarketPrice: number;
  correctedBuybackPrice: number;
  reason: string;
  userApprovedCorrection: boolean | null;
  /** Read-only display when request is no longer in INSPECTING phase */
  readOnly?: boolean;
}

export function PriceCorrectionPrompt({
  itemId,
  cardName,
  originalBuybackPrice,
  correctedMarketPrice,
  correctedBuybackPrice,
  reason,
  userApprovedCorrection,
  readOnly = false,
}: PriceCorrectionPromptProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleResponse(accept: boolean) {
    if (readOnly) return;
    startTransition(async () => {
      const result = await respondToPriceCorrection(itemId, accept);
      if (result?.success) {
        toast.success(
          accept
            ? "Correctie geaccepteerd — bedankt!"
            : "Correctie afgewezen — de kaart wordt teruggestuurd of niet uitbetaald.",
        );
        router.refresh();
      } else {
        toast.error(result?.error ?? "Er ging iets mis");
      }
    });
  }

  // Already responded — read-only summary
  if (userApprovedCorrection === true) {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-lg border-l-4 border-emerald-400 bg-emerald-50/70 p-3 text-xs dark:border-emerald-500 dark:bg-emerald-950/30">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">
            Prijscorrectie geaccepteerd
          </p>
          <p className="text-emerald-800/80 dark:text-emerald-200/80">
            Nieuwe inkoopprijs: <strong>€{correctedBuybackPrice.toFixed(2)}</strong> (was €{originalBuybackPrice.toFixed(2)})
          </p>
        </div>
      </div>
    );
  }
  if (userApprovedCorrection === false) {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-lg border-l-4 border-red-400 bg-red-50/70 p-3 text-xs dark:border-red-500 dark:bg-red-950/30">
        <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <p className="text-red-900 dark:text-red-100">
          Prijscorrectie afgewezen — deze kaart wordt niet ingekocht.
        </p>
      </div>
    );
  }

  // Pending — interactive (or read-only if request is past INSPECTING)
  return (
    <div className="mt-2 rounded-lg border-l-4 border-amber-400 bg-amber-50/70 p-3 dark:border-amber-500 dark:bg-amber-950/30">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Prijscorrectie voorgesteld voor {cardName}
          </p>
          <div className="mt-1.5 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <p className="text-amber-800/70 dark:text-amber-300/70">Oorspronkelijk</p>
              <p className="font-mono text-amber-900 line-through decoration-red-500/60 dark:text-amber-100">
                €{originalBuybackPrice.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-amber-800/70 dark:text-amber-300/70">Voorstel</p>
              <p className="font-mono font-semibold text-amber-900 dark:text-amber-100">
                €{correctedBuybackPrice.toFixed(2)}{" "}
                <span className="text-[10px] font-normal text-amber-800/70 dark:text-amber-300/70">
                  (Marktprijs €{correctedMarketPrice.toFixed(2)})
                </span>
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs italic text-amber-800/90 dark:text-amber-200/90">
            <strong>Reden:</strong> {reason}
          </p>
          {!readOnly && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleResponse(true)}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Accepteer correctie
              </button>
              <button
                type="button"
                onClick={() => handleResponse(false)}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/30"
              >
                <X className="h-3.5 w-3.5" /> Wijs af
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
