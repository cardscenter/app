import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

type DashboardPageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Knop(pen) rechts van de titel — gebruik buttonVariants voor links. */
  action?: ReactNode;
  /** Optionele terug-link boven de titel (backLabel verplicht erbij). */
  backHref?: string;
  backLabel?: string;
};

/**
 * Uniforme paginakop voor alle dashboard-pagina's (Fase 44). Elke page begint
 * met deze header als eerste kind van de `space-y-6`-root. String-loos:
 * vertaalde teksten komen via props binnen.
 */
export function DashboardPageHeader({
  title,
  subtitle,
  action,
  backHref,
  backLabel,
}: DashboardPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {backHref && backLabel && (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
