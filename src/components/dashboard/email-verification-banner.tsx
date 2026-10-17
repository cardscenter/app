"use client";

import { useState, useTransition } from "react";
import { MailWarning, CheckCircle2 } from "lucide-react";
import { resendVerificationEmail } from "@/actions/auth";
import { Callout } from "@/components/dashboard/ui/callout";
import { PILL_BTN_SM } from "@/components/ploy/tile-styles";

/**
 * "Bevestig je e-mailadres"-banner (Fase 42, aangescherpt in Fase 43).
 * Verschijnt in het dashboard zolang `emailVerifiedAt` null is. Sinds Fase 43
 * is verificatie een harde eis voor kopen/bieden/claimen/chatten/verkopen/
 * storten/uitbetalen — de banner is de primaire route naar de resend-mail.
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
    <Callout
      tone="yellow"
      icon={MailWarning}
      className="mb-6"
      title="Bevestig je e-mailadres"
      action={
        sent ? (
          <span className="cc-pill inline-flex items-center gap-1.5 bg-[var(--pastel-green)] px-3 py-1.5 text-xs font-semibold text-[var(--pastel-green-ink)]">
            <CheckCircle2 className="size-4" /> Verstuurd
          </span>
        ) : (
          <div>
            <button
              type="button"
              onClick={handleResend}
              disabled={pending}
              className={`${PILL_BTN_SM} disabled:opacity-60`}
            >
              {pending ? "Versturen…" : "Opnieuw versturen"}
            </button>
            {error && <p className="mt-1 text-xs font-medium text-[var(--destructive)]">{error}</p>}
          </div>
        )
      }
    >
      We hebben je een verificatielink gestuurd. Bevestigen is nodig voordat je kunt kopen, bieden,
      chatten, verkopen, storten of uitbetalen.
    </Callout>
  );
}
