import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type SettingsRowProps = {
  label: string;
  description?: string;
  icon?: LucideIcon;
  /** Koppelt het label aan de control (accessibility). */
  htmlFor?: string;
  /**
   * "inline" (default) = control rechts naast het label.
   * "stacked" = control full-width onder het label (sliders, grotere forms).
   */
  layout?: "inline" | "stacked";
  /** De control: Switch, Select, slider-form, … */
  children: ReactNode;
};

/**
 * Klassieke settings-rij (Fase 44): label + beschrijving links, control rechts.
 * Gebruik binnen een DashboardSection met
 * `contentClassName="divide-y divide-border py-1 px-5"` zodat rijen gescheiden
 * worden door dunne lijnen.
 */
export function SettingsRow({
  label,
  description,
  icon: Icon,
  htmlFor,
  layout = "inline",
  children,
}: SettingsRowProps) {
  const header = (
    <div className="flex min-w-0 items-start gap-3">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );

  if (layout === "stacked") {
    return (
      <div className="py-4 first:pt-0 last:pb-0">
        {header}
        <div className="mt-3 w-full">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      {header}
      <div className="shrink-0 sm:pl-4">{children}</div>
    </div>
  );
}
