"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import Image from "next/image";
import { toast } from "sonner";
import {
  Check,
  X,
  MapPin,
  Calendar,
  Star,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import {
  approveEvent,
  rejectEvent,
  setEventOfficial,
  setTrustedOrganizer,
} from "@/actions/admin/events";
import { getEventTypeLabel, EVENT_TYPE_PILL_CLASSES, type EventType } from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import { formatEventDateRange } from "@/lib/events/timezones";
import { CountryFlag } from "@/components/ui/country-flag";

interface OrganizerInfo {
  id: string;
  displayName: string | null;
  email: string;
  createdAt: Date;
  isVerified: boolean;
  isIbanVerified: boolean;
  isAddressVerified: boolean;
  isTrustedEventOrganizer: boolean;
}

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  venueName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  timezone: string;
  lat: number | null;
  lng: number | null;
  startTime: string;
  endTime: string;
  entryType: string;
  entryPrice: number | null;
  entryCurrency: string | null;
  registrationUrl: string | null;
  coverImage: string | null;
  isOfficial: boolean;
  isSanctioned: boolean;
  createdAt: string;
  organizer: OrganizerInfo;
}

export function AdminEventApprovalList({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Geen evenementen in de wachtrij.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <EventApprovalCard key={event.id} event={event} />
      ))}
    </div>
  );
}

function EventApprovalCard({ event }: { event: EventRow }) {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const dateLabel = formatEventDateRange(start, end, event.timezone, locale === "en" ? "en-GB" : "nl-NL");

  function handleApprove() {
    startTransition(async () => {
      const res = await approveEvent(event.id);
      if (res?.error) toast.error(res.error);
      else toast.success("Evenement goedgekeurd");
    });
  }

  function handleReject() {
    if (reason.trim().length < 5) {
      toast.error("Reden minimaal 5 tekens");
      return;
    }
    startTransition(async () => {
      const res = await rejectEvent(event.id, reason);
      if (res?.error) toast.error(res.error);
      else toast.success("Evenement afgewezen");
    });
  }

  function handleToggleOfficial() {
    startTransition(async () => {
      const res = await setEventOfficial(event.id, !event.isOfficial);
      if (res?.error) toast.error(res.error);
      else toast.success(event.isOfficial ? "Geverifieerd-markering verwijderd" : "Gemarkeerd als geverifieerd");
    });
  }

  function handleToggleTrusted() {
    startTransition(async () => {
      const res = await setTrustedOrganizer(event.organizer.id, !event.organizer.isTrustedEventOrganizer);
      if (res?.error) toast.error(res.error);
      else toast.success(event.organizer.isTrustedEventOrganizer ? "Vertrouwd-status verwijderd" : "Organisator gemarkeerd als vertrouwd");
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Thumbnail */}
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-28 sm:w-44">
          {event.coverImage ? (
            <Image src={event.coverImage} alt={event.title} fill className="object-cover" sizes="200px" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Calendar className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${EVENT_TYPE_PILL_CLASSES[event.eventType as EventType] ?? "bg-muted text-muted-foreground"}`}>
              {getEventTypeLabel(event.eventType, locale)}
            </span>
          </div>

          <h3 className="mt-1.5 text-base font-bold text-foreground">{event.title}</h3>

          <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" /> {dateLabel}
            </p>
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {event.venueName}, {event.street} {event.houseNumber}, {event.postalCode} {event.city}
              <CountryFlag code={event.country} size="sm" />
              {getEventCountryName(event.country, locale)}
              {event.lat === null && <span className="text-amber-600 dark:text-amber-400">(geen kaart-pin)</span>}
            </p>
            <p>
              Entree: {event.entryType === "FREE" ? "Gratis" : `${event.entryCurrency ?? ""} ${event.entryPrice ?? ""}`}
              {event.registrationUrl && (
                <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                  Aanmeldlink <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
          </div>

          {event.description && (
            <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{event.description}</p>
          )}

          {/* Organisator */}
          <div className="mt-3 rounded-lg bg-muted/60 p-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{event.organizer.displayName ?? "Onbekend"}</span>
              <span className="text-muted-foreground">{event.organizer.email}</span>
              {event.organizer.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  <ShieldCheck className="h-3 w-3" /> ID
                </span>
              )}
              {event.organizer.isTrustedEventOrganizer && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Star className="h-3 w-3" /> Vertrouwd
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Acties */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> Goedkeuren
        </button>
        <button
          onClick={() => setShowReject((v) => !v)}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
        >
          <X className="h-4 w-4" /> Afwijzen
        </button>
        <button
          onClick={handleToggleOfficial}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
            event.isOfficial
              ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300"
              : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          <ShieldCheck className="h-4 w-4" /> {event.isOfficial ? "Geverifieerd" : "Markeer geverifieerd"}
        </button>
        <button
          onClick={handleToggleTrusted}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
            event.organizer.isTrustedEventOrganizer
              ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
              : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          <Star className="h-4 w-4" /> {event.organizer.isTrustedEventOrganizer ? "Vertrouwd" : "Markeer organisator vertrouwd"}
        </button>
      </div>

      {showReject && (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reden voor afwijzing (zichtbaar voor de organisator)…"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={handleReject}
            disabled={isPending}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            Bevestig afwijzing
          </button>
        </div>
      )}
    </div>
  );
}
