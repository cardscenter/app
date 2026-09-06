import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ChangeIndicator } from "@/components/dashboard/statistics/change-indicator";

// KPI-kaart in fintech-stijl: icoon + label links, periode-hint rechts, groot
// getal met trend, en een "vs vorige periode"-regel eronder.

type Props = {
  icon: LucideIcon;
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`flex size-8 items-center justify-center rounded-lg ${iconClass ?? "bg-primary/10 text-primary"}`}>
            <Icon className="size-4" />
          </span>
          <p className="text-sm font-semibold text-foreground">{label}</p>
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
        {comparison && (
          <ChangeIndicator change={comparison.change} direction={comparison.direction} invert={comparison.invert} />
        )}
      </div>
      {footnote && <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-border bg-card p-5 shadow-card";
  return href ? (
    <Link href={href} className={`${cls} transition-shadow hover:shadow-card-hover`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
