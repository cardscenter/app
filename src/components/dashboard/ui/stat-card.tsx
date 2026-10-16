import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Kleur van de icoon-tegel, default primair. Bv. "bg-emerald-500/10 text-emerald-500". */
  iconClassName?: string;
  /** Maakt de hele tegel klikbaar. */
  href?: string;
  /** Kleine subregel onder de waarde. */
  hint?: string;
};

/**
 * KPI-tegel voor het dashboard (Fase 44). Vlakke dash-card, geen glass, geen
 * hover-scale — subtiele hover-tint wanneer klikbaar.
 */
export function StatCard({ label, value, icon: Icon, iconClassName, href, hint }: StatCardProps) {
  const inner = (
    <div className="flex items-start gap-3">
      {Icon && (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            iconClassName ?? "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="cc-display mt-1 truncate text-3xl tabular-nums text-foreground">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );

  const shell = "block dash-card p-5";

  if (href) {
    return (
      <Link href={href} className={cn(shell, "transition-transform hover:-translate-y-0.5")}>
        {inner}
      </Link>
    );
  }
  return <div className={shell}>{inner}</div>;
}
