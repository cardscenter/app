import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Meestal een Link met buttonVariants. */
  action?: ReactNode;
  /** py-10 i.p.v. py-16, voor gebruik binnen een DashboardSection. */
  compact?: boolean;
};

/**
 * Dé lege-staat van het dashboard (Fase 44) — vervangt de vijf verschillende
 * empty-state-stijlen die per pagina waren ontstaan.
 */
export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-6 text-center",
        compact ? "py-10" : "py-16"
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
