import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

export interface CatalogFilter {
  label: string;
  href: string;
  active: boolean;
}

/**
 * Catalogus (referentie Ploybooks): filterchips als pillen, rechts een
 * optionele werkbalk (bv. lijst/kalender), daaronder de grid die de
 * aanroeper vult met punch-cards. `empty` wordt getoond zonder kinderen.
 */
export function CatalogGrid({ filters, toolbar, children, empty, grid = true, className = "" }: { filters?: CatalogFilter[][]; toolbar?: ReactNode; children?: ReactNode; empty?: ReactNode; grid?: boolean; className?: string }) {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : !!children;
  return (
    <section className={`flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16 ${className}`}>
      <div className="w-full max-w-6xl">
        {(filters || toolbar) && (
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {filters?.map((group, gi) => (
                <div key={gi} className="flex flex-wrap items-center gap-2">
                  {gi > 0 && <span className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" aria-hidden />}
                  {group.map((f) => (
                    <Link
                      key={f.href + f.label}
                      href={f.href}
                      aria-current={f.active ? "true" : undefined}
                      className={`cc-pill inline-flex h-9 items-center px-4 text-sm font-semibold no-underline transition-colors ${f.active ? "bg-[var(--foreground)] text-white" : "bg-white text-[var(--foreground)]/75 hover:text-[var(--foreground)]"}`}
                    >
                      {f.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            {toolbar && <div className="shrink-0">{toolbar}</div>}
          </div>
        )}
        {hasChildren ? <div className={grid ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : ""}>{children}</div> : empty}
      </div>
    </section>
  );
}
