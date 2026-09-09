"use client";

import { useState } from "react";

export type SellerHistoryTab = {
  key: string;
  label: string;
  count?: number;
  content: React.ReactNode;
};

/**
 * Tab-strip van het verkopersprofiel (redesign sept 2026, Portfolia-stijl):
 * onderstreepte tabs op één lijn met een kleine superscript-teller, geen
 * pillen. Panelen komen server-rendered binnen als ReactNode;
 * mount-on-first-activate + `hidden` (patroon EventDetailTabs).
 */
export function SellerHistoryTabs({ tabs }: { tabs: SellerHistoryTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const [visited, setVisited] = useState<Set<string>>(() => new Set(tabs[0] ? [tabs[0].key] : []));

  if (tabs.length === 0) return null;

  function activate(key: string) {
    setActive(key);
    setVisited((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }

  return (
    <div>
      <div className="overflow-x-auto border-b border-border">
        <div role="tablist" className="-mb-px flex gap-6 px-1">
          {tabs.map((t) => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => activate(t.key)}
                className={`relative inline-flex shrink-0 items-center gap-1.5 border-b-2 pb-3 pt-1 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {typeof t.count === "number" && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-muted-foreground">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-6">
        {tabs.map((t) =>
          visited.has(t.key) ? (
            <div key={t.key} role="tabpanel" className={active === t.key ? "" : "hidden"}>
              {t.content}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
