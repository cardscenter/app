import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-[var(--pastel-green)] text-[var(--foreground)]",
  warning: "bg-[var(--pastel-yellow)] text-[var(--foreground)]",
  danger: "bg-[var(--pastel-pink)] text-[var(--foreground)]",
  info: "bg-[var(--pastel-blue)] text-[var(--foreground)]",
  neutral: "bg-muted text-foreground/70",
  primary: "bg-foreground text-white",
};

type StatusBadgeProps = {
  tone: StatusTone;
  icon?: LucideIcon;
  children: ReactNode;
};

/**
 * Uniforme status-pill voor het dashboard (Fase 44). Pagina's houden hun eigen
 * domein-map `status → { tone, label }`; dit component levert alleen de
 * visuele taal zodat pills overal identiek ogen.
 */
export function StatusBadge({ tone, icon: Icon, children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "cc-pill inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 text-xs font-semibold leading-none",
        TONE_CLASSES[tone]
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}
