import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ChangeIndicator } from "@/components/dashboard/statistics/change-indicator";
import { TONE_ICON, type DashTone } from "@/components/dashboard/ui/tones";
import { cn } from "@/lib/utils";

// KPI-tegel (design-pass ronde G): pastel icoon-cirkel linksboven, daaronder
// het getal in de display-letter + label, rechtsonder de delta (of een
// periode-hint). Optionele voetnoot voor uitleg in één regel.

type Props = {
  icon: LucideIcon;
  /** Pastel-toon van de icoon-cirkel. */
  tone?: DashTone;
  /**
   * @deprecated Gebruik `tone`. Oude aanroepers geven een Tailwind-kleur mee
   * (`text-emerald-600` …); die wordt hier naar een pastel-toon vertaald.
   */
  iconClass?: string;
  label: string;
  hint?: string;
  value: string;
  comparison?: { change: number; direction: "up" | "down" | "flat"; invert?: boolean };
  footnote?: string;
  href?: string;
};

function toneFromClass(iconClass?: string): DashTone {
  if (!iconClass) return "pink";
  if (iconClass.includes("emerald") || iconClass.includes("green")) return "green";
  if (iconClass.includes("amber") || iconClass.includes("yellow")) return "yellow";
  if (iconClass.includes("sky") || iconClass.includes("blue")) return "blue";
  return "pink";
}

export function HomeKpiCard({ icon: Icon, tone, iconClass, label, hint, value, comparison, footnote, href }: Props) {
  const resolvedTone = tone ?? toneFromClass(iconClass);
  const body = (
    <>
      <span className={cn("flex size-10 items-center justify-center rounded-full", TONE_ICON[resolvedTone])}>
        <Icon className="size-[18px]" />
      </span>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="cc-display truncate text-3xl tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
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
  const cls = "block dash-card p-5";
  return href ? (
    <Link href={href} className={`${cls} no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
