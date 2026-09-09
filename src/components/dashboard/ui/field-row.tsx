import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FieldRowProps = {
  label: string;
  /** Korte uitleg onder het label (één regel, muted). */
  hint?: ReactNode;
  /** Koppelt het label aan de control (accessibility). */
  htmlFor?: string;
  /** Extra klassen op de control-kolom (bv. `max-w-md`). */
  contentClassName?: string;
  /** Anker-id (bv. "team" voor /dashboard/profiel#team). */
  id?: string;
  children: ReactNode;
};

/**
 * Formulier-rij in "profiel-stijl" (sept 2026): label + uitleg in de linker
 * kolom, de control rechts. Rijen binnen één blok worden gescheiden door
 * verticale ruimte, niet door lijnen — alleen een nieuw blok krijgt een
 * eigen kaart. Gebruik `divide-y` op de parent als je tóch lijnen wilt.
 */
export function FieldRow({ label, hint, htmlFor, contentClassName, id, children }: FieldRowProps) {
  return (
    <div id={id} className="grid scroll-mt-24 gap-2 py-5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)] md:gap-8">
      <div className="min-w-0 md:pt-2">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
    </div>
  );
}
