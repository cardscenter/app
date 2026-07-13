import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DashboardSectionProps = {
  title: string;
  description?: string;
  /** Lucide-icoon, size-4/size-5 — gerenderd vóór de titel. */
  icon?: ReactNode;
  /** Rechts in de header-balk: badge, count of knop. */
  action?: ReactNode;
  /**
   * "card" (default) = solide kaart met header-balk (profiel-stijl).
   * "plain" = alleen een sectie-kop; children zijn zelf al cards (lijst-groepen).
   */
  variant?: "card" | "plain";
  /** Override voor de card-body, bv. "divide-y divide-border py-1 px-5" voor settings-rijen. */
  contentClassName?: string;
  children: ReactNode;
};

/**
 * Dé sectie-primitive van het dashboard (Fase 44). Vervangt de lokale
 * Section-helpers van profiel en verificatie zodat sectie-koppen overal
 * identiek ogen. String-loos: teksten komen via props binnen.
 */
export function DashboardSection({
  title,
  description,
  icon,
  action,
  variant = "card",
  contentClassName,
  children,
}: DashboardSectionProps) {
  if (variant === "plain") {
    return (
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            {title}
          </h2>
          {action}
        </div>
        {description && (
          <p className="-mt-2 mb-4 text-sm text-muted-foreground">{description}</p>
        )}
        {children}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}
