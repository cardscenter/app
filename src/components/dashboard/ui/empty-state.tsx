import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_ICON, type DashTone } from "./tones";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Meestal een Link met buttonVariants. */
  action?: ReactNode;
  /** Minder hoog, voor gebruik binnen een DashboardSection. */
  compact?: boolean;
  /** Pastel-toon van de icoon-cirkel (default yellow). */
  tone?: DashTone;
};

/**
 * Dé lege staat van het dashboard (design-pass ronde G): witte punch-card met
 * vier hoekstippen, pastel icoon-cirkel, korte tekst en optioneel een pil-actie.
 */
export function EmptyState({ icon: Icon, title, description, action, compact, tone = "yellow" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "cc-punch flex flex-col items-center justify-center gap-2 rounded-[20px] bg-white px-6 text-center shadow-card",
        compact ? "py-10" : "py-16",
      )}
      style={{ "--cc-dot": "var(--border)" } as CSSProperties}
    >
      <span className="cc-punch-dots" aria-hidden />
      <div className={cn("flex size-12 items-center justify-center rounded-full", TONE_ICON[tone])}>
        <Icon className="size-6" />
      </div>
      <p className="mt-1 text-base font-semibold tracking-[-0.02em] text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
