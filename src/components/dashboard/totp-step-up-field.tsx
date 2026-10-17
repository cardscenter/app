"use client";

import { ShieldCheck } from "lucide-react";
import { INPUT } from "@/components/ploy/tile-styles";

/**
 * Herbruikbaar step-up 2FA-veld (Fase 16-followup). Wordt getoond zodra een
 * action `{ totpRequired: true }` teruggeeft — de gebruiker vult de code in
 * en verstuurt het formulier opnieuw. Op vertrouwde apparaten (30d-cookie)
 * verschijnt dit veld nooit.
 */
export function TotpStepUpField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-[14px] bg-[var(--pastel-blue-light)] p-3.5 text-[var(--pastel-blue-ink)]">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/google_auth.webp" alt="" width={18} height={18} className="rounded" />
        <span className="text-sm font-semibold">Google Authenticator</span>
        <ShieldCheck className="size-4" />
      </div>
      <p className="text-xs opacity-80">
        Vul de 6-cijferige code uit je authenticator-app in.
      </p>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={9}
        required
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="123456"
        className={`${INPUT} !w-40 text-center tracking-[0.25em]`}
      />
    </div>
  );
}
