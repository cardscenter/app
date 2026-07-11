"use client";

import { useState } from "react";

type TabKey = "info" | "location" | "visitors" | "vendors" | "media";

type EventDetailTabsProps = {
  info: React.ReactNode | null;
  location: React.ReactNode;
  visitors: React.ReactNode;
  vendors: React.ReactNode;
  media: React.ReactNode | null;
  /** Badge-tellers naast de tab-labels (bv. aantal aanwezigen/standhouders). */
  visitorsCount?: number;
  vendorsCount?: number;
};

/** Tab-indeling voor de event-detailpagina (hybride layout: hero + tickets
 *  blijven altijd zichtbaar, de rest zit hier). Panelen worden server-rendered
 *  aangeleverd als ReactNode; mount-on-first-activate + verbergen met `hidden`
 *  voorkomt de Leaflet-zero-size-bug en behoudt kaart/iframe-state. */
export function EventDetailTabs({ info, location, visitors, vendors, media, visitorsCount, vendorsCount }: EventDetailTabsProps) {
  const tabs: Array<{ key: TabKey; label: string; content: React.ReactNode; count?: number }> = [
    ...(info ? [{ key: "info" as const, label: "Info", content: info }] : []),
    { key: "location" as const, label: "Locatie", content: location },
    { key: "visitors" as const, label: "Bezoekers", content: visitors, count: visitorsCount },
    { key: "vendors" as const, label: "Standhouders", content: vendors, count: vendorsCount },
    ...(media ? [{ key: "media" as const, label: "Media", content: media }] : []),
  ];

  const [active, setActive] = useState<TabKey>(tabs[0].key);
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set([tabs[0].key]));

  function activate(key: TabKey) {
    setActive(key);
    setVisited((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
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
                {typeof t.count === "number" && t.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
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
