import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_SURFACE, type DashTone } from "./tones";

type CalloutProps = {
  /** yellow = let op, blue = info, pink = probleem, green = gelukt. */
  tone?: DashTone;
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  /** Knop of link rechts (onder de tekst op mobiel). */
  action?: ReactNode;
  className?: string;
};

/**
 * Infoblok in een pastel-vlak (design-pass ronde G). Vervangt de losse
 * `border-amber-200 bg-amber-50`-, `bg-blue-50`- en `bg-red-50`-blokken.
 */
export function Callout({ tone = "yellow", icon: Icon, title, children, action, className }: CalloutProps) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-[14px] px-4 py-3.5 sm:flex-row sm:items-center", TONE_SURFACE[tone], className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {Icon && <Icon className="mt-0.5 size-[18px] shrink-0" />}
        <div className="min-w-0 text-sm">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title && "mt-0.5 opacity-85")}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
