"use client";

import { ShieldCheck } from "lucide-react";

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
    <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/google_auth.webp" alt="" width={18} height={18} className="rounded" />
        <span className="text-sm font-medium text-foreground">Google Authenticator</span>
        <ShieldCheck className="size-4 text-primary" />
      </div>
      <p className="text-xs text-muted-foreground">
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
        className="w-40 rounded-lg border border-border bg-card px-3 py-2 text-center text-sm tracking-[0.25em] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
