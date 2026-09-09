"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { History } from "lucide-react";

export type UsernameHistoryEntry = {
  oldName: string;
  changedAt: Date | string;
};

/**
 * Naamgeschiedenis bij een @handle op publieke profielen.
 *
 * Een gebruikersnaam is (bijna) permanent, maar kan één keer door de gebruiker
 * zelf en verder door support gewijzigd worden. Daarom hoort elke oude naam
 * zichtbaar te blijven: een koper moet kunnen zien onder welke naam iemand
 * eerder handelde, zodat een slechte reputatie niet weg te poetsen is.
 *
 * Opent op hover (desktop) én op klik (touch, waar hover niet bestaat); sluit
 * op klik buiten, Escape of blur.
 */
export function UsernameHistoryBadge({
  history,
  className = "",
}: {
  history: UsernameHistoryEntry[];
  className?: string;
}) {
  const t = useTranslations("profile");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (history.length === 0) return null;

  return (
    <span
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("previousNames")}
        title={t("previousNames")}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <History className="size-3" />
        {history.length}
      </button>

      {open && (
        <span className="absolute left-1/2 top-full z-50 mt-1.5 block w-64 -translate-x-1/2 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <span className="mb-2 block text-xs font-semibold text-foreground">
            {t("previousNames")}
          </span>
          <span className="block divide-y divide-border">
            {history.map((entry, i) => (
              <span key={i} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                <span className="truncate text-muted-foreground">@{entry.oldName}</span>
                <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground/70">
                  {format.dateTime(new Date(entry.changedAt), {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </span>
            ))}
          </span>
          <span className="mt-2 block text-[11px] leading-relaxed text-muted-foreground/80">
            {t("previousNamesNote")}
          </span>
        </span>
      )}
    </span>
  );
}
