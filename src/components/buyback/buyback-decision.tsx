"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { CheckCircle2, PackageOpen, CreditCard } from "lucide-react";
import { acceptAdjustedBuyback, requestBuybackReturn } from "@/actions/buyback";
import { RETURN_FEE_EUR, canAcceptAdjusted, canRequestReturn } from "@/lib/buyback-status";
import { buttonVariants } from "@/components/ui/button-variants";
import { PILL_BTN } from "@/components/ploy/tile-styles";

/**
 * Keuze van de verkoper na controle (Fase 6): akkoord met de aangepaste
 * berekening, of de (afgekeurde) kaarten retour tegen RETURN_FEE_EUR, vooraf
 * te betalen via Mollie (of de simulatiepagina zonder Mollie-key).
 */
export function BuybackDecision({ request }: { request: { id: string; status: string; userDecision: string | null; decisionDeadline: string | null; finalPayout: number | null; returnPayment: { status: string; checkoutUrl: string | null } | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const deadline = request.decisionDeadline ? new Date(request.decisionDeadline) : null;
  const paymentOpen = request.returnPayment && (request.returnPayment.status === "OPEN" || request.returnPayment.status === "PENDING");

  if (!canRequestReturn(request)) return null;

  function accept() {
    start(async () => {
      const r = await acceptAdjustedBuyback(request.id);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success("Akkoord vastgelegd. De uitbetaling wordt verwerkt.");
      router.refresh();
    });
  }
  function requestReturn() {
    start(async () => {
      const r = await requestBuybackReturn(request.id);
      if ("error" in r && r.error) return void toast.error(r.error);
      if ("checkoutUrl" in r && r.checkoutUrl) window.location.href = r.checkoutUrl;
    });
  }

  return (
    <section className="rounded-[20px] bg-[var(--pastel-yellow)] p-5 text-[var(--pastel-yellow-ink)] sm:p-6">
      <h3 className="text-lg font-semibold tracking-[-0.03em]">Wat wil je doen?</h3>
      <p className="mt-1 text-sm opacity-90">
        {request.status === "PARTIALLY_APPROVED"
          ? `Ga akkoord met de nieuwe berekening (€${(request.finalPayout ?? 0).toFixed(2)}), of vraag je afgekeurde kaarten retour.`
          : "Vraag je kaarten retour, of laat ze bij ons achter."}{" "}
        Retour kost <strong>€{RETURN_FEE_EUR.toFixed(2)}</strong> (verzekerde verzending), vooraf te betalen.
        {deadline && ` Kies vóór ${deadline.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {canAcceptAdjusted(request) && (
          <button type="button" onClick={accept} disabled={pending} className={buttonVariants()}>
            <CheckCircle2 className="size-4" /> Akkoord, betaal uit
          </button>
        )}
        <button type="button" onClick={requestReturn} disabled={pending} className={`${PILL_BTN} disabled:opacity-50`}>
          {paymentOpen ? <CreditCard className="size-4" /> : <PackageOpen className="size-4" />}
          {paymentOpen ? `Retourkosten betalen (€${RETURN_FEE_EUR.toFixed(2)})` : `Kaarten retour (€${RETURN_FEE_EUR.toFixed(2)})`}
        </button>
      </div>
      <p className="mt-3 text-xs opacity-80">
        Zonder keuze binnen de termijn {request.status === "PARTIALLY_APPROVED" ? "betalen we het aangepaste bedrag uit en blijven de afgekeurde kaarten bij ons" : "blijven de kaarten bij Cards Center"}. Dat staat ook in de voorwaarden.
      </p>
    </section>
  );
}
