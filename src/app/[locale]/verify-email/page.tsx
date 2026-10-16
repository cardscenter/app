import { CheckCircle2, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { verifyEmail } from "@/actions/auth";
import { auth } from "@/lib/auth";
import { AuthFrame } from "@/components/ploy/auth-frame";

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
    <AuthFrame width="sm">
      <div className="w-full text-center">
        <div
          className={`mx-auto mb-4 flex size-12 items-center justify-center rounded-full ${
            ok
              ? "bg-[var(--pastel-green)] text-[var(--foreground)]"
              : "bg-[var(--pastel-pink)] text-[var(--foreground)]"
          }`}
        >
          {ok ? (
            <CheckCircle2 className="size-6" />
          ) : (
            <XCircle className="size-6" />
          )}
        </div>
        <h1 className="cc-display text-[40px] text-[var(--foreground)] sm:text-[48px]">
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
          className="mt-6 cc-pill inline-flex w-full items-center justify-center gap-1.5 bg-[var(--primary)] px-6 py-4 text-sm font-semibold leading-none text-white transition-colors hover:bg-[var(--primary-hover)]"
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
            className="mt-3 cc-pill inline-flex w-full items-center justify-center gap-1.5 border border-[var(--border)] bg-white px-6 py-4 text-sm font-semibold leading-none text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
          >
            Overslaan — naar je dashboard
          </Link>
        )}
      </div>
    </AuthFrame>
  );
}
