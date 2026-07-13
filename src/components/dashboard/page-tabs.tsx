"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type PageTab = {
  href: string;
  label: string;
  /** Live count-badge naast het label. Verborgen bij 0/undefined. */
  badge?: number;
  /** Alleen actief bij exacte pathname-match (voor parent-routes met subroutes in dezelfde tabset). */
  exact?: boolean;
  /**
   * Verberg de tab tenzij hij actief is (deep-link blijft dan visueel geen
   * wees) — gebruikt voor de Evenementen-tab wanneer de user nog geen events
   * heeft.
   */
  hideUnlessActive?: boolean;
};

type PageTabsProps = {
  tabs: PageTab[];
};

/**
 * Sub-navigatie voor samengevoegde dashboard-clusters (Fase 44): Aanbod
 * (veilingen/claimsales/marktplaats/evenementen), Financiën
 * (saldo/uitbetalingen/openstaande-kosten) en Reputatie (reviews/level).
 * Actieve tab = langste prefix-match zodat een parent-tab niet oplicht op
 * een subroute die zijn eigen tab heeft.
 */
export function PageTabs({ tabs }: PageTabsProps) {
  const pathname = usePathname();

  // Langste prefix-match wint: /dashboard/saldo licht niet op wanneer
  // /dashboard/saldo/openstaande-kosten een eigen tab heeft.
  const activeHref = tabs.reduce<string | null>((best, tab) => {
    const matches = tab.exact
      ? pathname === tab.href
      : pathname === tab.href || pathname.startsWith(tab.href + "/");
    if (!matches) return best;
    if (!best || tab.href.length > best.length) return tab.href;
    return best;
  }, null);

  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1">
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        if (tab.hideUnlessActive && !active) return null;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
