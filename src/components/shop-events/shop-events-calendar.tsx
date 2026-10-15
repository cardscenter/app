"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ShopEventListItem } from "@/lib/shop-events/queries";
import { eventColorClasses } from "@/lib/shop-events/config";
import { dayKey, formatEventTime, formatMonthHeading, SHOP_TIMEZONE } from "@/lib/shop-events/format";

/**
 * Compacte maandkalender voor winkel-events (client, geen deps). Weken
 * beginnen op maandag; dagen in winkel-tijd. Op smalle schermen een
 * agenda-lijst per dag i.p.v. een 7-koloms grid.
 */
export function ShopEventsCalendar({ events, locale }: { events: ShopEventListItem[]; locale: string }) {
  const t = useTranslations("shopEvents");
  const firstEvent = events[0] ? new Date(events[0].startsAt) : new Date();
  const [cursor, setCursor] = useState(() => startOfMonth(firstEvent));

  const byDay = useMemo(() => {
    const map = new Map<string, ShopEventListItem[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.startsAt));
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [events]);

  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const todayKey = dayKey(new Date());
  const monthKeyOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const inMonth = (k: string) => k.startsWith(monthKeyOf(cursor));
  const weekdays = useMemo(() => {
    const base = new Date(Date.UTC(2024, 0, 1)); // maandag
    return Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nl-NL", { weekday: "short", timeZone: "UTC" }).format(new Date(base.getTime() + i * 86_400_000)),
    );
  }, [locale]);

  const monthEvents = days.filter((d) => inMonth(d.key)).flatMap((d) => byDay.get(d.key) ?? []);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => setCursor(addMonths(cursor, -1))} className="rounded-full p-2 hover:bg-muted" aria-label={t("prevMonth")}>
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="text-base font-semibold text-foreground">{formatMonthHeading(new Date(cursor.getTime() + 12 * 3600_000), locale)}</h2>
        <button type="button" onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-full p-2 hover:bg-muted" aria-label={t("nextMonth")}>
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Desktop grid */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-px text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {weekdays.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {days.map((d) => {
            const list = byDay.get(d.key) ?? [];
            const muted = !inMonth(d.key);
            return (
              <div key={d.key} className={`min-h-[88px] bg-card p-1.5 ${muted ? "opacity-40" : ""} ${d.key === todayKey ? "ring-2 ring-inset ring-primary/50" : ""}`}>
                <div className="text-xs font-medium text-muted-foreground">{d.day}</div>
                <div className="mt-1 space-y-1">
                  {list.slice(0, 3).map((e) => (
                    <Link
                      key={e.id}
                      href={`/evenementen/${e.id}`}
                      title={e.title}
                      className={`block truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${eventColorClasses(e.typeColor).pill}`}
                    >
                      {formatEventTime(new Date(e.startsAt), locale)} {e.title}
                    </Link>
                  ))}
                  {list.length > 3 && <div className="text-[11px] text-muted-foreground">+{list.length - 3}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobiel: agenda per dag */}
      <div className="space-y-2 sm:hidden">
        {monthEvents.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("noEventsThisMonth")}</p>}
        {monthEvents.map((e) => {
          const c = eventColorClasses(e.typeColor);
          return (
            <Link key={e.id} href={`/evenementen/${e.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <span className={`size-2.5 shrink-0 rounded-full ${c.dot}`} />
              <span className="w-12 shrink-0 text-xs text-muted-foreground">{new Date(e.startsAt).getUTCDate() && dayLabel(new Date(e.startsAt), locale)}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{e.title}</span>
              <span className="text-xs text-muted-foreground">{formatEventTime(new Date(e.startsAt), locale)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function dayLabel(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nl-NL", { timeZone: SHOP_TIMEZONE, day: "numeric", month: "short" }).format(d);
}

function startOfMonth(d: Date): Date {
  const k = dayKey(d);
  return new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** 6 weken × 7 dagen, maandag eerst, sleutels als "YYYY-MM-DD". */
function buildMonthGrid(monthStart: Date): Array<{ key: string; day: number }> {
  const first = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1));
  const offset = (first.getUTCDay() + 6) % 7; // ma=0
  const gridStart = new Date(first.getTime() - offset * 86_400_000);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getTime() + i * 86_400_000);
    return { key: d.toISOString().slice(0, 10), day: d.getUTCDate() };
  });
}
