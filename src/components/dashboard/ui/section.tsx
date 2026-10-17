import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_SURFACE, type DashTone } from "./tones";

type DashboardSectionProps = {
  title: string;
  description?: string;
  /** Lucide-icoon, size-4/size-5, gerenderd vóór de titel. */
  icon?: ReactNode;
  /** Rechts in de kop: badge, count of knop. */
  action?: ReactNode;
  /**
   * "card" (default) = witte kaart met kop.
   * "plain" = alleen een sectie-kop; children zijn zelf al kaarten (lijst-groepen).
   */
  variant?: "card" | "plain";
  /** Pastel-vlak i.p.v. een witte kaart (alleen bij variant "card"). */
  tone?: DashTone;
  /** Override voor de body, bv. "divide-y divide-border py-1" voor settings-rijen. */
  contentClassName?: string;
  children: ReactNode;
};

/**
 * Dé sectie-primitive van het dashboard (design-pass ronde G): witte kaart
 * (`dash-card`) met een rustige kop zonder scheidingslijn, of een pastel-vlak
 * via `tone`. String-loos: teksten komen via props binnen.
 */
export function DashboardSection({
  title,
  description,
  icon,
  action,
  variant = "card",
  tone,
  contentClassName,
  children,
}: DashboardSectionProps) {
  if (variant === "plain") {
    return (
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            {title}
          </h2>
          {action}
        </div>
        {description && <p className="-mt-2 mb-3 text-sm text-muted-foreground">{description}</p>}
        {children}
      </section>
    );
  }

  const tinted = tone !== undefined && tone !== "neutral";
  return (
    <section className={cn("overflow-hidden", tinted ? cn("rounded-[20px]", TONE_SURFACE[tone]) : "dash-card")}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon && <span className={tinted ? "opacity-70" : "text-muted-foreground"}>{icon}</span>}
            <h2 className={cn("text-lg font-semibold tracking-[-0.03em]", !tinted && "text-foreground")}>{title}</h2>
          </div>
          {description && <p className={cn("mt-0.5 text-sm", tinted ? "opacity-75" : "text-muted-foreground")}>{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("px-5 pb-5 pt-4 sm:px-6 sm:pb-6", contentClassName)}>{children}</div>
    </section>
  );
}
