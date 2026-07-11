"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { EventQuickViewPanel } from "@/components/events/event-quick-view";
import type { EventListItem } from "@/components/events/event-view-types";

// Uitgelichte (gepromote) events eerst, daarna op tijd. De array komt al
// chronologisch binnen, dus een stabiele sort op `featured` volstaat.
function orderDayEvents(arr: EventListItem[]): EventListItem[] {
  return [...arr].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
}

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Datum-sleutel "yyyy-mm-dd" van een event in z'n eigen tijdzone.
function dayKeyInTz(iso: string, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(iso)); // en-CA → yyyy-mm-dd
}

// Begintijd "HH:mm" in de tijdzone van het event zelf.
function timeInTz(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("nl-NL", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function EventCalendarMonth({ events }: { events: EventListItem[] }) {
  // Begin op de maand van het eerstvolgende event, anders de huidige maand.
  const initial = useMemo(() => {
    if (events.length > 0) {
      const d = new Date(events[0].startTime);
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [events]);

  const [{ year, month }, setMonth] = useState(initial);
  const sp = useSearchParams();

  // "+N meer" → open die ene dag in de lijstweergave, met de huidige tab/filters.
  function dayHref(key: string): string {
    const params = new URLSearchParams(sp.toString());
    params.set("view", "list");
    params.set("date_from", key);
    params.set("date_to", key);
    return `/evenementen?${params.toString()}`;
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventListItem[]>();
    for (const e of events) {
      const key = dayKeyInTz(e.startTime, e.timezone);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const firstWeekday = (first.getDay() + 6) % 7; // maandag = 0
    const start = new Date(year, month, 1 - firstWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return {
        y: d.getFullYear(),
        m: d.getMonth(),
        d: d.getDate(),
        inMonth: d.getMonth() === month,
        key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      };
    });
  }, [year, month]);

  const todayKey = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  })();

  // Dagen in de zichtbare maand mét events — voor de mobiele agenda-weergave
  // en de lege-maand-melding.
  const agendaDays = useMemo(
    () => cells.filter((c) => c.inMonth && (eventsByDay.get(c.key)?.length ?? 0) > 0),
    [cells, eventsByDay],
  );

  function prev() {
    setMonth(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }));
  }
  function next() {
    setMonth(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }));
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      {/* Maand-navigatie */}
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prev} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted" aria-label="Vorige maand">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold text-foreground">{MONTHS[month]} {year}</h2>
        <button onClick={next} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted" aria-label="Volgende maand">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekdag-headers (desktop-grid) */}
      <div className="hidden grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-muted-foreground sm:grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      {/* Dag-cellen (desktop-grid) */}
      <div className="hidden grid-cols-7 gap-1 sm:grid">
        {cells.map((cell) => {
          const dayEvents = orderDayEvents(eventsByDay.get(cell.key) ?? []);
          const isToday = cell.key === todayKey;
          return (
            <div
              key={cell.key}
              className={`relative min-h-[84px] rounded-lg border p-1 sm:min-h-[110px] ${
                isToday
                  ? "border-blue-500 bg-background ring-1 ring-blue-500"
                  : cell.inMonth ? "border-border bg-background" : "border-transparent bg-muted/30"
              }`}
            >
              <div className={`mb-1 text-right text-xs font-medium ${
                isToday
                  ? "mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white"
                  : cell.inMonth ? "text-foreground" : "text-muted-foreground/50"
              }`}>
                {cell.d}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((e) => (
                  <div key={e.id} className="group/qv relative">
                    <Link
                      href={`/evenementen/${e.id}`}
                      className={`flex items-center gap-1 rounded-md p-0.5 text-[10px] font-medium transition ${
                        e.featured
                          ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900"
                          : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-900"
                      }`}
                    >
                      <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded bg-muted">
                        {e.coverImage ? (
                          <Image src={e.coverImage} alt="" fill className="object-cover" sizes="20px" unoptimized />
                        ) : (
                          <span className="flex h-full items-center justify-center"><Calendar className="h-3 w-3 text-muted-foreground" /></span>
                        )}
                      </span>
                      <span className="truncate">{e.title}</span>
                    </Link>
                    {/* Hover quick-view (desktop). pointer-events-auto + geen gap
                        zodat je met de muis naar het paneel kunt en het klikbaar
                        is. Op touch geen hover → tap = link. */}
                    <Link
                      href={`/evenementen/${e.id}`}
                      className="absolute left-1/2 top-full z-50 hidden -translate-x-1/2 pt-1 group-hover/qv:block"
                    >
                      <EventQuickViewPanel event={e} />
                    </Link>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <Link
                    href={dayHref(cell.key)}
                    className="block rounded-md px-1 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    +{dayEvents.length - 3} meer
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lege maand (desktop) */}
      {agendaDays.length === 0 && (
        <p className="mt-3 hidden rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground sm:block">
          Geen evenementen in {MONTHS[month]} {year}. Blader naar een andere maand of pas je filters aan.
        </p>
      )}

      {/* Mobiel: agenda-weergave — één rij per dag mét events (7 kolommen is
          te krap op kleine schermen). Zelfde maand-navigatie hierboven. */}
      <div className="sm:hidden">
        {agendaDays.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Geen evenementen in {MONTHS[month]} {year}. Blader naar een andere maand of pas je filters aan.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {agendaDays.map((cell) => {
              const dayEvents = orderDayEvents(eventsByDay.get(cell.key) ?? []);
              const isToday = cell.key === todayKey;
              const weekday = WEEKDAYS[(new Date(cell.y, cell.m, cell.d).getDay() + 6) % 7];
              return (
                <div key={cell.key} className="flex gap-3 py-3 first:pt-1 last:pb-1">
                  <div className={`h-fit w-12 shrink-0 rounded-lg py-1.5 text-center ${
                    isToday ? "bg-blue-500 text-white" : "bg-muted text-foreground"
                  }`}>
                    <div className="text-lg font-bold leading-tight">{cell.d}</div>
                    <div className={`text-[10px] font-semibold uppercase ${isToday ? "text-white/90" : "text-muted-foreground"}`}>
                      {weekday}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {dayEvents.map((e) => (
                      <Link
                        key={e.id}
                        href={`/evenementen/${e.id}`}
                        className={`flex items-center gap-2.5 rounded-lg p-2 transition ${
                          e.featured
                            ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900"
                            : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-900"
                        }`}
                      >
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                          {e.coverImage ? (
                            <Image src={e.coverImage} alt="" fill className="object-cover" sizes="36px" unoptimized />
                          ) : (
                            <span className="flex h-full items-center justify-center"><Calendar className="h-4 w-4 text-muted-foreground" /></span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{e.title}</span>
                          <span className="block truncate text-xs opacity-75">
                            {timeInTz(e.startTime, e.timezone)} · {e.city}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
