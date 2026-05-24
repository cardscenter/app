import { CheckCircle2, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { verifyEmail } from "@/actions/auth";

/**
 * E-mailverificatie-pagina (Fase 42). Verzilvert de `?token=` uit de
 * verificatie-mail server-side en toont het resultaat.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await verifyEmail(token ?? "");
  const ok = "success" in result;

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
            ? "Bedankt! Je e-mailadres is bevestigd. Je kunt nu alles op Cards Center gebruiken."
            : "error" in result
              ? result.error
              : "Er ging iets mis."}
        </p>
        <Link
          href={ok ? "/dashboard" : "/login"}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {ok ? "Naar je dashboard" : "Naar inloggen"}
        </Link>
      </div>
    </div>
  );
}
