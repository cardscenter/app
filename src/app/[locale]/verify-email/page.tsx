import { CheckCircle2, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { verifyEmail } from "@/actions/auth";
import { auth } from "@/lib/auth";

/**
 * E-mailverificatie-pagina (Fase 42, onboarding-landing sinds Fase 43).
 * Verzilvert de `?token=` uit de verificatie-mail server-side. Bij succes
 * stuurt de CTA door naar de onboarding-wizard op /welkom; is de link op een
 * ander device geopend (geen of andere sessie), dan eerst inloggen met
 * callbackUrl naar /welkom.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await verifyEmail(token ?? "");
  const ok = "success" in result;

  const session = await auth();
  const isOwnSession = ok && session?.user?.id === result.userId;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <div
          className={`mx-auto mb-4 flex size-12 items-center justify-center rounded-full ${
            ok
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {ok ? (
            <CheckCircle2 className="size-6" />
          ) : (
            <XCircle className="size-6" />
          )}
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {ok ? "E-mailadres bevestigd" : "Verificatie mislukt"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ok
            ? isOwnSession
              ? "Bedankt! Je e-mailadres is bevestigd. Rond in een paar korte stappen je account af — dan kun je direct kopen, bieden en verkopen."
              : "Bedankt! Je e-mailadres is bevestigd. Log in om je account af te ronden."
            : "error" in result
              ? result.error
              : "Er ging iets mis."}
        </p>
        <Link
          href={
            ok
              ? isOwnSession
                ? "/welkom"
                : "/login?callbackUrl=/welkom"
              : "/login"
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {ok
            ? isOwnSession
              ? "Account inrichten"
              : "Inloggen en verdergaan"
            : "Naar inloggen"}
        </Link>
        {ok && isOwnSession && (
          <Link
            href="/dashboard"
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Overslaan — naar je dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
