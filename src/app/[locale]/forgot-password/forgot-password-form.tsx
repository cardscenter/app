"use client";

import { useActionState } from "react";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { sent?: boolean; error?: string } | null, formData: FormData) => {
      const result = await requestPasswordReset(formData);
      if ("success" in result) return { sent: true };
      return { error: result.error };
    },
    null,
  );

  if (state?.sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--pastel-green)] text-[var(--foreground)]">
          <CheckCircle2 className="size-6" />
        </div>
        <h1 className="cc-display text-[40px] text-[var(--foreground)] sm:text-[48px]">Check je inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Als er een account bij dit e-mailadres hoort, hebben we een link
          gestuurd om je wachtwoord opnieuw in te stellen. De link is 1 uur
          geldig.
        </p>
        <Link
          href="/login"
          className="mt-6 cc-pill inline-flex w-full items-center justify-center gap-1.5 bg-[var(--primary)] px-6 py-4 text-sm font-semibold leading-none text-white transition-colors hover:bg-[var(--primary-hover)]"
        >
          Terug naar inloggen
        </Link>
      </div>
    );
  }

  return (
    <div className="">
      <div className="mb-6">
        <h1 className="cc-display text-[40px] text-[var(--foreground)] sm:text-[48px]">
          Wachtwoord vergeten?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vul je e-mailadres in. We sturen je een link om een nieuw wachtwoord
          in te stellen.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        {state?.error && (
          <p className="rounded-[12px] bg-[var(--pastel-pink)] p-3 text-sm text-[var(--foreground)]">
            {state.error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            E-mailadres
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="naam@voorbeeld.nl"
              className="h-11 pl-9 text-base"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="cc-pill inline-flex w-full items-center justify-center gap-1.5 bg-[var(--primary)] px-6 py-4 text-sm font-semibold leading-none text-white transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Versturen…" : "Stuur reset-link"}
          {!pending && <ArrowRight className="size-4" />}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Terug naar inloggen
          </Link>
        </p>
      </form>
    </div>
  );
}
