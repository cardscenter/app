import type { ReactNode } from "react";
import { Pill, type PastelColor } from "./pill";

export interface DataTile {
  label: string;
  value: ReactNode;
  hint?: string;
}

/**
 * Datakaart (referentie analytics-pagina): witte kaart met een kop-pil,
 * tegels met label + grote waarde en een vrij blok eronder (tabel, lijst).
 */
export function DataCard({ badge, badgeColor = "blue", title, tiles, children, className = "", columns = 2 }: { badge?: string; badgeColor?: PastelColor; title?: string; tiles?: DataTile[]; children?: ReactNode; className?: string; columns?: 2 | 3 | 4 }) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <div className={`rounded-[12px] bg-white p-5 shadow-[0_2px_8px_0_var(--cc-border-subtle)] sm:p-6 ${className}`}>
      {(badge || title) && (
        <div className="mb-5 flex items-center gap-3">
          {badge && <Pill color={badgeColor}>{badge}</Pill>}
          {title && <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">{title}</h2>}
        </div>
      )}
      {tiles && (
        <dl className={`grid gap-x-6 gap-y-5 ${cols}`}>
          {tiles.map((t) => (
            <div key={t.label} className="min-w-0 border-l-2 border-[var(--border)] pl-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--foreground)]/50">{t.label}</dt>
              <dd className="mt-1 text-base font-semibold leading-snug text-[var(--foreground)]">{t.value}</dd>
              {t.hint && <p className="mt-0.5 text-xs text-[var(--foreground)]/55">{t.hint}</p>}
            </div>
          ))}
        </dl>
      )}
      {children && <div className={tiles ? "mt-6" : ""}>{children}</div>}
    </div>
  );
}
