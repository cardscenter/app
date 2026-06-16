"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { EVENT_COUNTRIES } from "@/lib/events/countries";
import { OTHER_EVENT_TYPES, EVENT_TYPE_LABELS_NL, type EventType } from "@/lib/events/types";

export function EventFilterSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const tab = sp.get("tab") === "events" ? "events" : "beurzen";
  const country = sp.get("country") ?? "";
  const dateFrom = sp.get("date_from") ?? "";
  const dateTo = sp.get("date_to") ?? "";
  const official = sp.get("official") === "1";
  const free = sp.get("free") === "1";
  const selectedTypes = new Set((sp.get("type") ?? "").split(",").filter(Boolean));

  function update(mut: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString());
    mut(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setParam(key: string, value: string) {
    update((p) => (value ? p.set(key, value) : p.delete(key)));
  }

  function toggleType(type: EventType) {
    const next = new Set(selectedTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    update((p) => (next.size ? p.set("type", [...next].join(",")) : p.delete("type")));
  }

  const activeCount =
    (country ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (official ? 1 : 0) + (free ? 1 : 0) + selectedTypes.size;

  function clearAll() {
    const params = new URLSearchParams();
    params.set("tab", tab);
    const view = sp.get("view");
    if (view) params.set("view", view);
    router.push(`${pathname}?${params.toString()}`);
  }

  const labelClass = "block text-sm font-semibold text-foreground";
  const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">Filters</h3>
        {activeCount > 0 && (
          <button onClick={clearAll} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> Wis ({activeCount})
          </button>
        )}
      </div>

      {/* Land */}
      <div>
        <label className={labelClass} htmlFor="filter-country">Land</label>
        <select
          id="filter-country"
          value={country}
          onChange={(e) => setParam("country", e.target.value)}
          className={inputClass}
        >
          <option value="">Alle landen</option>
          {EVENT_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.nameNl}</option>
          ))}
        </select>
      </div>

      {/* Type (alleen op de Events-tab; Beurzen toont per definitie alleen beurzen) */}
      {tab === "events" && (
        <div>
          <p className={labelClass}>Type</p>
          <div className="mt-2 space-y-1.5">
            {OTHER_EVENT_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={() => toggleType(type)}
                  className="h-4 w-4 rounded border-border"
                />
                {EVENT_TYPE_LABELS_NL[type]}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Datum */}
      <div>
        <p className={labelClass}>Datum</p>
        <div className="mt-1 space-y-2">
          <input type="date" value={dateFrom} onChange={(e) => setParam("date_from", e.target.value)} className={inputClass} aria-label="Vanaf" />
          <input type="date" value={dateTo} onChange={(e) => setParam("date_to", e.target.value)} className={inputClass} aria-label="Tot" />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={official} onChange={(e) => update((p) => (e.target.checked ? p.set("official", "1") : p.delete("official")))} className="h-4 w-4 rounded border-border" />
          Alleen geverifieerd (Cards Center)
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={free} onChange={(e) => update((p) => (e.target.checked ? p.set("free", "1") : p.delete("free")))} className="h-4 w-4 rounded border-border" />
          Alleen gratis entree
        </label>
      </div>
    </div>
  );
}
