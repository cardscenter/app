import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { TONE_ICON, type DashTone } from "./tones";

type DashTileProps = {
  href: string;
  icon: LucideIcon;
  /** Klein label bovenaan (bv. "Volgende ticket"). */
  label: string;
  /** Hoofdregel: grote waarde of titel. */
  title: ReactNode;
  /** Zet de titel in de display-letter (voor getallen). */
  display?: boolean;
  /** Subregel onder de titel. */
  hint?: ReactNode;
  tone?: DashTone;
  /** Vrije inhoud onder de tekst (stempelkaart, voortgangsbalk). */
  children?: ReactNode;
  className?: string;
};

/**
 * Link-tegel voor het dashboard (design-pass ronde G): witte kaart met een
 * pastel icoon-cirkel, label, titel of getal en een pijl rechtsboven die bij
 * hover meebeweegt. Gebruikt op de dashboard-home en in overzichten.
 */
export function DashTile({ href, icon: Icon, label, title, display, hint, tone = "yellow", children, className }: DashTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 dash-card p-5 no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", TONE_ICON[tone])}>
          <Icon className="size-[18px]" />
        </span>
        <ArrowUpRight className="size-4 text-foreground/35 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-foreground", display ? "cc-display text-3xl tabular-nums" : "line-clamp-2 text-base font-semibold leading-snug tracking-[-0.02em]")}>
          {title}
        </p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Link>
  );
}
