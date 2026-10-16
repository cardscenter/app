import type { ReactNode } from "react";
import { DisplayHeading } from "./display-heading";

export interface FeatureRow {
  title?: string;
  number?: string;
  text: ReactNode;
}

/**
 * Rijen met scheidingslijnen (referentie cli-pagina): titel of nummer links,
 * uitleg rechts. Voor "goed om te weten", huisregels en voorwaarden.
 */
export function FeatureRows({ title, intro, rows, id, className = "" }: { title?: string; intro?: ReactNode; rows: FeatureRow[]; id?: string; className?: string }) {
  return (
    <section id={id} className={`flex justify-center px-4 py-12 sm:px-5 lg:px-6 lg:py-16 ${className}`}>
      <div className="w-full max-w-6xl">
        {(title || intro) && (
          <div className="mb-8 flex flex-col gap-4 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
            {title && <DisplayHeading tag="h2" size={3} text={title} className="max-w-[24rem]" />}
            {intro && <div className="cc-prose max-w-[26rem] text-base">{intro}</div>}
          </div>
        )}
        <dl className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10 md:py-6">
              <dt className="flex items-baseline gap-3 text-lg font-semibold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
                {r.number && <span className="cc-display text-2xl text-[var(--primary)]">{r.number}</span>}
                {r.title}
              </dt>
              <dd className="cc-prose text-base">{r.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
