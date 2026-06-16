"use client";

import Image from "next/image";
import { Calendar, MapPin, Ticket, ShieldCheck, Users } from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getEventTypeLabel, EVENT_TYPE_PILL_CLASSES, type EventType } from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import { formatEventDateRange } from "@/lib/events/timezones";
import { EVENT_LABEL_TEXT_NL, COLOR_CLASSES, type EventLabelType, type LabelColor } from "@/lib/events/labels";
import { CountryFlag } from "@/components/ui/country-flag";
import type { EventListItem } from "@/components/events/event-view-types";

export function EventCard({ event }: { event: EventListItem }) {
  const locale = useLocale();
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const dateLabel = formatEventDateRange(start, end, event.timezone, locale === "en" ? "en-GB" : "nl-NL");

  return (
    <Link
      href={`/evenementen/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition hover:shadow-card-hover sm:flex-row"
    >
      <div className="relative h-40 w-full shrink-0 bg-muted sm:h-auto sm:w-52">
        {event.coverImage ? (
          <Image src={event.coverImage} alt="" fill className="object-cover" sizes="(max-width:640px) 100vw, 208px" unoptimized />
        ) : (
          <div className="flex h-full min-h-32 items-center justify-center text-muted-foreground">
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
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${EVENT_TYPE_PILL_CLASSES[event.eventType as EventType] ?? "bg-muted"}`}>
            {getEventTypeLabel(event.eventType, locale)}
          </span>
          {event.labels.map((l) => (
            <span key={l.type} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLOR_CLASSES[l.colorKey as LabelColor] ?? "bg-slate-700 text-white"}`}>
              {EVENT_LABEL_TEXT_NL[l.type as EventLabelType] ?? l.type}
            </span>
          ))}
        </div>

        <h3 className="text-base font-bold leading-snug text-foreground group-hover:text-primary">{event.title}</h3>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" /> {dateLabel}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {event.venueName}, {event.city}
          <CountryFlag code={event.country} size="sm" /> {getEventCountryName(event.country, locale)}
        </p>
        <p className="mt-auto flex items-center gap-1.5 text-sm">
          <Ticket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className={event.entryType === "FREE" ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
            {event.entryType === "FREE" ? "Gratis entree" : `${event.entryCurrency ?? ""} ${event.entryPrice ?? ""}`}
          </span>
        </p>
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
