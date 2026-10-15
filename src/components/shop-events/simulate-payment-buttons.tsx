"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Ban } from "lucide-react";
import { simulatePayment } from "@/actions/shop-events";

/** Knoppen van de simulatie-"bank": geslaagd / mislukt / geannuleerd. */
export function SimulatePaymentButtons({
  paymentId,
  returnPath,
  guestToken,
  alreadySettled,
}: {
  paymentId: string;
  /** Locale-loos pad (de i18n-router voegt de taal toe). */
  returnPath: string;
  guestToken?: string | null;
  alreadySettled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(outcome: "paid" | "failed" | "canceled") {
    startTransition(async () => {
      const r = await simulatePayment(paymentId, outcome, guestToken ?? null);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.push(returnPath);
    });
  }

  if (alreadySettled) {
    return (
      <div className="mt-6">
        <p className="text-sm text-muted-foreground">Deze betaling is al afgehandeld.</p>
        <button type="button" onClick={() => router.push(returnPath)} className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
          Terug naar de app
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-3">
      <button type="button" disabled={pending} onClick={() => pick("paid")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
        <CheckCircle2 className="size-4" /> Betaling geslaagd
      </button>
      <button type="button" disabled={pending} onClick={() => pick("failed")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
        <XCircle className="size-4" /> Mislukt
      </button>
      <button type="button" disabled={pending} onClick={() => pick("canceled")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted disabled:opacity-60">
        <Ban className="size-4" /> Geannuleerd
      </button>
    </div>
  );
}
