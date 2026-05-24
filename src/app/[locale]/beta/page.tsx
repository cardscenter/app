import { Lock } from "lucide-react";

/**
 * Beta-gate unlock-pagina (pre-launch). Tijdelijke, interne pagina — bewust
 * hardcoded NL, geen i18n-keys nodig. Het formulier POST't naar
 * `/api/beta-unlock` dat bij juist wachtwoord de cookie zet en doorstuurt.
 */
export default async function BetaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-card">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Cards Center — besloten test
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Deze site is nog niet openbaar. Vul het testwachtwoord in om verder
            te gaan.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            Onjuist wachtwoord. Probeer het opnieuw.
          </p>
        )}

        <form action="/api/beta-unlock" method="POST" className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input
            type="password"
            name="password"
            required
            autoFocus
            placeholder="Testwachtwoord"
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Toegang
          </button>
        </form>
      </div>
    </div>
  );
}
