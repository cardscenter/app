import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-400",
  info: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/25 bg-primary/10 text-primary",
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
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone]
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}
