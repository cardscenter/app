import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { TONE_ICON, type DashTone } from "./tones";

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Pastel-toon van de icoon-cirkel (default yellow). */
  tone?: DashTone;
  /** @deprecated Gebruik `tone`. Blijft werken voor oude aanroepers. */
  iconClassName?: string;
  /** Maakt de hele tegel klikbaar. */
  href?: string;
  /** Kleine subregel onder de waarde. */
  hint?: string;
};

/**
 * KPI-tegel voor het dashboard: witte kaart, waarde in de display-letter,
 * ronde icoon-cirkel in een pastel-toon. Komt licht omhoog als hij klikbaar is.
 */
export function StatCard({ label, value, icon: Icon, tone = "yellow", iconClassName, href, hint }: StatCardProps) {
  const inner = (
    <div className="flex items-start gap-3">
      {Icon && (
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", iconClassName ?? TONE_ICON[tone])}>
          <Icon className="size-[18px]" />
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
      <Link href={href} className={cn(shell, "no-underline transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-card-hover")}>
        {inner}
      </Link>
    );
  }
  return <div className={shell}>{inner}</div>;
}
