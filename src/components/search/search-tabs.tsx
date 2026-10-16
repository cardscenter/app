import { Link } from "@/i18n/navigation";

export interface SearchTab {
  key: string;
  label: string;
  count: number | null; // null = geen teller tonen (bv. PokéAPI down)
  href: string;
}

/**
 * Categorie-tabs voor /zoeken (Alles · Kaarten · Pokémon · Aanbod ·
 * Gebruikers). Query-param-gedreven (?tab=), dus geen PageTabs-hergebruik —
 * die matcht op pathname. Design-pass: pillen zoals de catalogusfilters.
 */
export function SearchTabs({ tabs, active }: { tabs: SearchTab[]; active: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            scroll={false}
            aria-current={isActive ? "true" : undefined}
            className={`cc-pill inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap px-4 text-sm font-semibold no-underline transition-colors ${isActive ? "bg-[var(--foreground)] text-white" : "bg-white text-[var(--foreground)]/75 hover:text-[var(--foreground)]"}`}
          >
            {tab.label}
            {tab.count !== null && <span className={`cc-pill px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums ${isActive ? "bg-white/20 text-white" : "bg-[var(--background)] text-[var(--foreground)]/60"}`}>{tab.count > 999 ? "999+" : tab.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
