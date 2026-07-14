import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface SearchTab {
  key: string;
  label: string;
  count: number | null; // null = geen teller tonen (bv. PokéAPI down)
  href: string;
}

/**
 * Categorie-tabs voor /zoeken (Alles · Kaarten · Pokémon · Aanbod ·
 * Gebruikers). Query-param-gedreven (?tab=), dus geen PageTabs-hergebruik —
 * die matcht op pathname. Styling volgt wel dezelfde pill-bar-taal.
 */
export function SearchTabs({ tabs, active }: { tabs: SearchTab[]; active: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            scroll={false}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count !== null && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count > 999 ? "999+" : tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
