"use client";

import { useState, useTransition } from "react";
import { MailWarning, CheckCircle2 } from "lucide-react";
import { resendVerificationEmail } from "@/actions/auth";

/**
 * Zachte "bevestig je e-mailadres"-banner (Fase 42). Verschijnt in het dashboard
 * zolang `emailVerifiedAt` null is. Blokkeert niets — browsen/kopen blijft vrij;
 * verkopen/uitbetalen wordt los geguard via `requireEmailVerified`.
 */
export function EmailVerificationBanner() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleResend() {
    setError(null);
    startTransition(async () => {
      const result = await resendVerificationEmail();
      if ("success" in result) setSent(true);
      else setError(result.error);
    });
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-200">
        <MailWarning className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">Bevestig je e-mailadres</p>
          <p className="mt-0.5 text-amber-700 dark:text-amber-300/90">
            We hebben je een verificatielink gestuurd. Bevestigen is nodig
            voordat je kunt verkopen of uitbetalen.
          </p>
        </div>
      </div>
      {sent ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" /> Verstuurd
        </span>
      ) : (
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleResend}
            disabled={pending}
            className="inline-flex items-center justify-center rounded-lg border border-amber-400 bg-card px-3 py-1.5 font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            {pending ? "Versturen…" : "Opnieuw versturen"}
          </button>
          {error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
