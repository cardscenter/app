"use client";

import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { Lock, Check, Loader2 } from "lucide-react";
import { changePassword } from "@/actions/auth";
import { TotpStepUpField } from "@/components/dashboard/totp-step-up-field";

/**
 * Wachtwoord-wijzigen rij + uitklap-formulier op /dashboard/profiel
 * (Fase 16-followup — vervangt de "Wijzigen via support"-placeholder).
 * Zelfde rij-styling als ReadOnlyRow in de profiel-page.
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

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <div className="flex items-center justify-between gap-4 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-muted-foreground">
            <Lock className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Wachtwoord</p>
            <p className="truncate text-sm font-medium text-foreground">••••••••</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
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
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-border px-3 py-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
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

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

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
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
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
