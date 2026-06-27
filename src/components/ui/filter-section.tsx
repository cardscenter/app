"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Gedeelde filter-bouwstenen voor alle overzicht-sidebars
 * (marktplaats / veilingen / claimsales / evenementen).
 *
 * Conventie — exact zoals in de Collectr-stijl:
 *   • <CheckboxRow>  = vierkant vinkje → meerdere opties tegelijk selecteerbaar
 *   • <RadioRow>     = rond bolletje  → precies één optie
 *
 * <FilterSection> is een inklapbaar blok met optionele teller-badge en een
 * korte `description` onder de titel die uitlegt wat het filter doet.
 */

interface FilterSectionProps {
  title: string;
  /** Aantal actieve selecties in deze sectie → teller-badge naast de titel. */
  count?: number;
  defaultOpen?: boolean;
  /** Korte uitleg onder de titel (Collectr-stijl), bv. "Filter op vraagprijs". */
  description?: string;
  children: ReactNode;
}

export function FilterSection({
  title,
  count = 0,
  defaultOpen = false,
  description,
  children,
}: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="border-t border-border first:border-t-0 py-3"
    >
      <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-foreground list-none">
        <span className="flex items-center gap-2">
          {title}
          {count > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </summary>
      {description && (
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 rounded border-border accent-primary focus:ring-primary"
      />
      <span className="flex-1">{label}</span>
    </label>
  );
}

export function RadioRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground hover:bg-muted">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 border-border accent-primary focus:ring-primary"
      />
      <span className="flex-1">{label}</span>
    </label>
  );
}
