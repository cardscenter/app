"use client";

import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { Lock, Check, Loader2 } from "lucide-react";
import { changePassword } from "@/actions/auth";
import { TotpStepUpField } from "@/components/dashboard/totp-step-up-field";
import { Callout } from "@/components/dashboard/ui/callout";
import { buttonVariants } from "@/components/ui/button-variants";
import { INPUT } from "@/components/ploy/tile-styles";

/**
 * Wachtwoord-wijzigen rij + uitklap-formulier op /dashboard/profiel
 * (Fase 16-followup — vervangt de "Wijzigen via support"-placeholder).
 * Sept 2026: rendert in de control-kolom van een <FieldRow>; label en
 * uitleg komen van de rij, hier alleen waarde + actie + uitklap-form.
 */
export function PasswordChangeForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (totpCode) formData.set("totpCode", totpCode);
    startTransition(async () => {
      const result = await changePassword(formData);
      if ("error" in result) {
        if ("totpRequired" in result && result.totpRequired) setTotpRequired(true);
        setError(result.error);
        return;
      }
      form.reset();
      setOpen(false);
      setSaved(true);
      setTotpRequired(false);
      setTotpCode("");
      setTimeout(() => setSaved(false), 4000);
    });
  }

  const inputClass = INPUT;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 rounded-[12px] border border-[var(--border)] bg-white px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
          <Lock className="size-4 text-muted-foreground" />
          <span className="tracking-[0.2em]">••••••••</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saved && (
            <span className="cc-pill flex items-center gap-1 bg-[var(--pastel-green)] px-2.5 py-1 text-xs font-semibold text-[var(--pastel-green-ink)]">
              <Check className="size-3.5" /> Gewijzigd
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen((o) => !o);
              setError(null);
            }}
            className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            {open ? "Annuleren" : "Wijzigen"}
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--background)] p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground/70">
              Huidig wachtwoord
            </label>
            <input
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/70">
                Nieuw wachtwoord
              </label>
              <input
                type="password"
                name="newPassword"
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/70">
                Herhaal nieuw wachtwoord
              </label>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Minimaal 8 tekens.</p>

          {totpRequired && <TotpStepUpField value={totpCode} onChange={setTotpCode} />}

          {error && <Callout tone="pink">{error}</Callout>}

          <div className="flex items-center justify-between gap-3">
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Huidig wachtwoord vergeten?
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className={buttonVariants()}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Wachtwoord wijzigen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
