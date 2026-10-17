"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, X } from "lucide-react";
import { respondToPriceCorrection } from "@/actions/buyback";
import { Callout } from "@/components/dashboard/ui/callout";
import { buttonVariants } from "@/components/ui/button-variants";
import { PILL_BTN_SM } from "@/components/ploy/tile-styles";
import { TONE_SURFACE } from "@/components/dashboard/ui/tones";

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
            ? "Correctie geaccepteerd, bedankt!"
            : "Correctie afgewezen. De kaart wordt teruggestuurd of niet uitbetaald.",
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
      <Callout tone="green" icon={Check} className="mt-2" title="Prijscorrectie geaccepteerd">
        Nieuwe inkoopprijs: <strong>€{correctedBuybackPrice.toFixed(2)}</strong> (was €{originalBuybackPrice.toFixed(2)})
      </Callout>
    );
  }
  if (userApprovedCorrection === false) {
    return (
      <Callout tone="pink" icon={X} className="mt-2">
        Prijscorrectie afgewezen. Deze kaart wordt niet ingekocht.
      </Callout>
    );
  }

  // Pending — interactive (or read-only if request is past INSPECTING)
  return (
    <div className={`mt-2 rounded-[14px] p-3.5 ${TONE_SURFACE.yellow}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Prijscorrectie voorgesteld voor {cardName}
          </p>
          <div className="mt-1.5 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <p className="opacity-70">Oorspronkelijk</p>
              <p className="font-mono line-through decoration-[var(--destructive)]/60">
                €{originalBuybackPrice.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="opacity-70">Voorstel</p>
              <p className="font-mono font-semibold">
                €{correctedBuybackPrice.toFixed(2)}{" "}
                <span className="text-[10px] font-normal opacity-70">
                  (Marktprijs €{correctedMarketPrice.toFixed(2)})
                </span>
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs italic opacity-90">
            <strong>Reden:</strong> {reason}
          </p>
          {!readOnly && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleResponse(true)}
                disabled={isPending}
                className={buttonVariants({ size: "sm" })}
              >
                <Check className="h-3.5 w-3.5" /> Accepteer correctie
              </button>
              <button
                type="button"
                onClick={() => handleResponse(false)}
                disabled={isPending}
                className={`${PILL_BTN_SM} h-8 text-[var(--destructive)] disabled:opacity-50`}
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
