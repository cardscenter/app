"use client";

import { useState } from "react";

export type SellerHistoryTab = {
  key: string;
  label: string;
  count?: number;
  content: React.ReactNode;
};

/**
 * Tab-strip voor het "Geschiedenis"-blok op het verkopersprofiel (Fase 45).
 * Panelen komen server-rendered binnen als ReactNode; mount-on-first-activate
 * + `hidden` (patroon EventDetailTabs).
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
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {tabs.map((t) => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => activate(t.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition sm:px-4 ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.label}
                {typeof t.count === "number" && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        {tabs.map((t) =>
          visited.has(t.key) ? (
            <div key={t.key} className={active === t.key ? "" : "hidden"}>
              {t.content}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
