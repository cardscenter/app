"use client";

import { useState, useTransition } from "react";
import { MailWarning, CheckCircle2 } from "lucide-react";
import { resendVerificationEmail } from "@/actions/auth";

/**
 * Verificatie-CTA die op /dashboard/saldo de stort-instructies vervangt zolang
 * het e-mailadres niet bevestigd is (Fase 43). De bankreferentie wordt zo nooit
 * getoond aan onbevestigde accounts. Zelfde toon/resend-flow als
 * EmailVerificationBanner.
 */
export function DepositVerifyGate() {
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
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-900/60 dark:bg-amber-950/30">
      <div className="flex items-start gap-3 text-amber-800 dark:text-amber-200">
        <MailWarning className="mt-0.5 size-6 shrink-0" />
        <div>
          <h2 className="text-base font-semibold">
            Bevestig je e-mailadres om geld te storten
          </h2>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300/90">
            Zodra je e-mailadres bevestigd is, zie je hier je persoonlijke
            betalingskenmerk en de stort-instructies. Check je inbox voor de
            verificatielink.
          </p>
          <div className="mt-3">
            {sent ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" /> Verificatiemail verstuurd
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={pending}
                className="inline-flex items-center justify-center rounded-lg border border-amber-400 bg-card px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                {pending ? "Versturen…" : "Verificatiemail opnieuw versturen"}
              </button>
            )}
            {error && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
