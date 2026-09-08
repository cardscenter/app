import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ChangeIndicator } from "@/components/dashboard/statistics/change-indicator";

// KPI-tegel in TailAdmin-anatomie (sept 2026): icoon-cirkel linksboven,
// daaronder groot getal + label, rechtsonder de delta (of een periode-hint).
// Optionele voetnoot voor uitleg in één regel.

type Props = {
  icon: LucideIcon;
  /** Kleur van het icoon (de cirkel zelf is altijd bg-muted). */
  iconClass?: string;
  label: string;
  hint?: string;
  value: string;
  comparison?: { change: number; direction: "up" | "down" | "flat"; invert?: boolean };
  footnote?: string;
  href?: string;
};

export function HomeKpiCard({ icon: Icon, iconClass, label, hint, value, comparison, footnote, href }: Props) {
  const body = (
    <>
      <span className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className={`size-5 ${iconClass ?? "text-primary"}`} />
      </span>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
        </div>
        {comparison ? (
          <ChangeIndicator change={comparison.change} direction={comparison.direction} invert={comparison.invert} />
        ) : hint ? (
          <p className="shrink-0 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {footnote && <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>}
    </>
  );
  const cls = "block dash-card p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-muted/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
