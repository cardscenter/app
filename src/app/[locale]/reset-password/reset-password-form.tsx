"use client";

import { useActionState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { resetPassword } from "@/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { done?: boolean; error?: string } | null, formData: FormData) => {
      const result = await resetPassword(formData);
      if ("success" in result) return { done: true };
      return { error: result.error };
    },
    null,
  );

  if (!token) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <h1 className="text-xl font-bold text-foreground">Ongeldige link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Deze reset-link is onvolledig. Vraag een nieuwe aan.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Nieuwe link aanvragen
        </Link>
      </div>
    );
  }

  if (state?.done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-6" />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          Wachtwoord gewijzigd
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Je kunt nu inloggen met je nieuwe wachtwoord.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Naar inloggen
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Nieuw wachtwoord instellen
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kies een nieuw wachtwoord van minstens 8 tekens.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="token" value={token} />

        {state?.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {state.error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">
            Nieuw wachtwoord
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            placeholder="••••••••"
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-foreground"
          >
            Herhaal wachtwoord
          </Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Opslaan…" : "Wachtwoord opslaan"}
          {!pending && <ArrowRight className="size-4" />}
        </button>
      </form>
    </div>
  );
}
