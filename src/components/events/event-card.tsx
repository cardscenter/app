"use client";

import Image from "next/image";
import { Calendar, MapPin, Ticket, ShieldCheck, Users, Sparkles, Gamepad2, Repeat, Tag, Ruler, Table2 } from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getEventTypeLabel, EVENT_TYPE_PILL_CLASSES, type EventType } from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import { formatEventDateRange } from "@/lib/events/timezones";
import { CountryFlag } from "@/components/ui/country-flag";
import type { EventListItem } from "@/components/events/event-view-types";

// "VT 09:00"-notatie (vroege toegang) in de event-tijdzone.
function earlyAccessLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("nl-NL", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function EventCard({ event }: { event: EventListItem }) {
  const locale = useLocale();
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const dateLabel = formatEventDateRange(start, end, event.timezone, locale === "en" ? "en-GB" : "nl-NL");

  return (
    <Link
      href={`/evenementen/${event.id}`}
      className={`group flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition hover:shadow-card-hover sm:flex-row ${
        event.featured
          ? "border-amber-300 ring-1 ring-amber-300 dark:border-amber-500/60 dark:ring-amber-500/40"
          : "border-border"
      }`}
    >
      {/* Banner altijd volledig in 3:1, tot aan de rand van het blok —
          mobiel bovenaan op volle breedte, desktop de linker 2/3 van de kaart. */}
      <div className="relative aspect-[3/1] w-full shrink-0 bg-muted sm:w-2/3">
        {event.coverImage ? (
          <Image src={event.coverImage} alt="" fill className="object-cover" sizes="(max-width:640px) 100vw, 66vw" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Calendar className="h-10 w-10" />
          </div>
        )}
        {event.isOfficial && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            <ShieldCheck className="h-3 w-3" /> Geverifieerd
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {event.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Sparkles className="h-3 w-3" /> Uitgelicht
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${EVENT_TYPE_PILL_CLASSES[event.eventType as EventType] ?? "bg-muted"}`}>
            {getEventTypeLabel(event.eventType, locale)}
          </span>
        </div>

        <h3 className="text-base font-bold leading-snug text-foreground group-hover:text-primary">{event.title}</h3>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" /> {dateLabel}
          {event.earlyAccessTime && (
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              · VT {earlyAccessLabel(event.earlyAccessTime, event.timezone)}
            </span>
          )}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {event.venueName}, {event.city}
          <CountryFlag code={event.country} size="sm" /> {getEventCountryName(event.country, locale)}
        </p>
        {/* Activiteiten-pills — wat kun je er doen? */}
        {(event.canPlay || event.canTrade || event.canSell) && (
          <div className="flex flex-wrap gap-1.5">
            {event.canSell && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                <Tag className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Verkopen
              </span>
            )}
            {event.canTrade && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                <Repeat className="h-3 w-3 text-sky-600 dark:text-sky-400" /> Ruilen
              </span>
            )}
            {event.canPlay && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                <Gamepad2 className="h-3 w-3 text-violet-600 dark:text-violet-400" /> Spelen
              </span>
            )}
          </div>
        )}

        <div className="mt-auto space-y-1 text-sm">
          <p className="flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className={event.entryType === "FREE" ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-foreground"}>
              {event.priceLabel}
            </span>
          </p>
          {(event.maxVisitors || event.venueSizeM2 || event.totalTables) && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {event.maxVisitors && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 shrink-0" /> Max. {event.maxVisitors} bezoekers
                </span>
              )}
              {event.venueSizeM2 && (
                <span className="flex items-center gap-1">
                  <Ruler className="h-3.5 w-3.5 shrink-0" /> {event.venueSizeM2} m²
                </span>
              )}
              {event.totalTables && (
                <span className="flex items-center gap-1">
                  <Table2 className="h-3.5 w-3.5 shrink-0" /> {event.totalTables} tafels
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Brede uitgelichte banner (betaalde promotie) — ≈3:1, voor de Uitgelicht-rij. */
export function EventBanner({ event }: { event: EventListItem }) {
  const locale = useLocale();
  const start = new Date(event.startTime);
  return (
    <Link
      href={`/evenementen/${event.id}`}
      className="group relative block aspect-[3/1] w-full overflow-hidden rounded-xl border border-border bg-muted shadow-card transition hover:shadow-card-hover"
    >
      {event.coverImage ? (
        <Image src={event.coverImage} alt={event.title} fill className="object-cover transition group-hover:scale-[1.02]" sizes="(max-width:1024px) 90vw, 700px" unoptimized />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground"><Calendar className="h-10 w-10" /></div>
      )}
      {/* Onderkant-gradient met titel */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <p className="text-xs font-medium text-white/80">
          {start.toLocaleDateString(locale === "en" ? "en-GB" : "nl-NL", { day: "numeric", month: "long" })} · {event.city}
        </p>
        <h3 className="text-lg font-bold leading-tight text-white">{event.title}</h3>
      </div>
    </Link>
  );
}

/** Lege-staat voor lijst/kalender. */
export function EventEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
      <Users className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
