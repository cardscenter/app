"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, List, Map as MapIcon, Store, Sparkles } from "lucide-react";

function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return { router, pathname, sp };
}

export function EventTabs() {
  const { router, pathname, sp } = useUrlState();
  const tab = sp.get("tab") === "events" ? "events" : "beurzen";

  function switchTab(value: "beurzen" | "events") {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", value);
    params.delete("type"); // type-filter verschilt per tab
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const tabs = [
    { key: "beurzen" as const, label: "Beurzen", icon: Store },
    { key: "events" as const, label: "Evenementen", icon: Sparkles },
  ];

  return (
    <div className="inline-flex rounded-xl border border-border bg-card p-1">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" /> {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function EventViewToggle() {
  const { router, pathname, sp } = useUrlState();
  const view = sp.get("view") === "month" ? "month" : sp.get("view") === "map" ? "map" : "list";

  function setView(value: "list" | "month" | "map") {
    const params = new URLSearchParams(sp.toString());
    params.set("view", value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const views = [
    { key: "list" as const, label: "Lijst", icon: List },
    { key: "month" as const, label: "Kalender", icon: CalendarDays },
    { key: "map" as const, label: "Kaart", icon: MapIcon },
  ];

  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      {views.map((v) => {
        const Icon = v.icon;
        const active = view === v.key;
        return (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}
