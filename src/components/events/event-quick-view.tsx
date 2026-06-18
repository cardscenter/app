"use client";

import Image from "next/image";
import { Calendar, MapPin, Ticket, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import { getEventTypeLabel, EVENT_TYPE_PILL_CLASSES, type EventType } from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import { formatEventDateRange } from "@/lib/events/timezones";
import { formatEuro } from "@/lib/events/format";
import { CountryFlag } from "@/components/ui/country-flag";
import type { EventListItem } from "@/components/events/event-view-types";

/** Vergroot quick-view-paneel (gebruikt in hover-popover boven kalender-
 *  thumbnails). Toont in één oogopslag waar de beurs/het event om gaat. */
export function EventQuickViewPanel({ event }: { event: EventListItem }) {
  const locale = useLocale();
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const dateLabel = formatEventDateRange(start, end, event.timezone, locale === "en" ? "en-GB" : "nl-NL");

  return (
    <div className="w-72 overflow-hidden rounded-xl border border-border bg-card shadow-card-hover">
      <div className="relative aspect-[16/10] w-full bg-muted">
        {event.coverImage ? (
          <Image src={event.coverImage} alt="" fill className="object-cover" sizes="288px" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Calendar className="h-8 w-8" />
          </div>
        )}
        {event.isOfficial && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            <ShieldCheck className="h-3 w-3" /> Geverifieerd
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVENT_TYPE_PILL_CLASSES[event.eventType as EventType] ?? "bg-muted"}`}>
            {getEventTypeLabel(event.eventType, locale)}
          </span>
        </div>
        <h4 className="text-sm font-bold leading-snug text-foreground">{event.title}</h4>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" /> {dateLabel}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" /> {event.venueName}, {event.city}
          <CountryFlag code={event.country} size="xs" /> {getEventCountryName(event.country, locale)}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Ticket className="h-3 w-3 shrink-0" />
          {event.entryType === "FREE" ? "Gratis entree" : event.entryPrice != null ? formatEuro(event.entryPrice) : "Tickets"}
        </p>
        <p className="pt-1 text-xs font-medium text-primary">Bekijk details →</p>
      </div>
    </div>
  );
}
