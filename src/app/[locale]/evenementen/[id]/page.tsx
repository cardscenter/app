import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import Image from "next/image";
import {
  Calendar, MapPin, Ticket, ExternalLink, ShieldCheck, Star, Users, Store, Globe, Table2,
  Gamepad2, Repeat, Tag, Car, Coffee, Toilet, Wifi, CreditCard, Accessibility, Shirt, Trophy, Baby,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { getEventTypeLabel, EVENT_TYPE_PILL_CLASSES, FACILITY_LABELS_NL, type EventType, type FacilityKey } from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import { formatEventDateRange } from "@/lib/events/timezones";
import { parseEventVideo } from "@/lib/events/video";
import { formatEuro } from "@/lib/events/format";
import { CountryFlag } from "@/components/ui/country-flag";
import { EventMap } from "@/components/events/event-map";
import { EventGallery } from "@/components/events/event-gallery";
import { EventReportButton } from "@/components/events/event-report-button";

const FACILITY_ICONS: Record<FacilityKey, React.ComponentType<{ className?: string }>> = {
  canPlay: Gamepad2, canTrade: Repeat, canSell: Tag, hasParking: Car, hasFood: Coffee,
  hasToilets: Toilet, hasWifi: Wifi, cardPayment: CreditCard, wheelchairAccessible: Accessibility, hasCloakroom: Shirt, childFriendly: Baby,
};
const FACILITY_ORDER: FacilityKey[] = [
  "canPlay", "canTrade", "canSell", "hasParking", "hasFood", "hasToilets", "hasWifi", "cardPayment", "wheelchairAccessible", "hasCloakroom", "childFriendly",
];

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      organizer: {
        select: {
          id: true, displayName: true, isVerified: true, isIbanVerified: true,
          isAddressVerified: true, isTrustedEventOrganizer: true,
        },
      },
    },
  });

  if (!event || event.status !== "LIVE") notFound();

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const dateLabel = formatEventDateRange(start, end, event.timezone, locale === "en" ? "en-GB" : "nl-NL");

  const activeFacilities = FACILITY_ORDER.filter((k) => event[k as keyof typeof event] as boolean);

  // Ticket-soorten (TIERS) + fallback voor legacy enkele prijs.
  let tiers: { name: string; price: number; description?: string; serviceFee?: number }[] = [];
  if (event.entryType === "PAID" && event.ticketTypes) {
    try {
      const parsed = JSON.parse(event.ticketTypes);
      if (Array.isArray(parsed)) tiers = parsed;
    } catch { /* negeer */ }
  }
  const ticketList =
    tiers.length > 0
      ? tiers
      : event.entryType === "PAID" && event.entryPrice != null
        ? [{ name: "Entree", price: event.entryPrice }]
        : [];

  let vendorOptions: { name: string; price: number; description?: string }[] = [];
  if (event.vendorOptions) {
    try {
      const parsed = JSON.parse(event.vendorOptions);
      if (Array.isArray(parsed)) vendorOptions = parsed;
    } catch { /* negeer */ }
  }
  const hasVendor = vendorOptions.length > 0 || !!event.vendorInfo || !!event.totalTables;

  const video = parseEventVideo(event.videoUrl);

  let galleryImages: string[] = [];
  if (event.galleryImages) {
    try {
      const parsed = JSON.parse(event.galleryImages);
      if (Array.isArray(parsed)) galleryImages = parsed.filter((u): u is string => typeof u === "string");
    } catch { /* negeer */ }
  }

  const organizerDisplay = event.organizerName?.trim() || event.organizer.displayName || "Onbekend";
  const hasOrganizerOverride = !!event.organizerName?.trim();

  // Andere lopende events van dezelfde organisator (account).
  const otherEvents = await prisma.event.findMany({
    where: {
      organizerId: event.organizer.id,
      status: "LIVE",
      endTime: { gte: new Date() },
      id: { not: event.id },
    },
    orderBy: { startTime: "asc" },
    take: 4,
    select: { id: true, title: true, startTime: true, timezone: true, coverImage: true, city: true },
  });

  return (
    <PageContainer width="default" className="py-8">
      <Link href="/evenementen" className="text-sm text-muted-foreground hover:text-foreground">← Terug naar evenementen</Link>

      {/* Banner */}
      <div className="relative mt-3 aspect-[3/1] w-full overflow-hidden rounded-2xl bg-muted">
        {event.coverImage ? (
          <Image src={event.coverImage} alt={event.title} fill className="object-cover" sizes="100vw" unoptimized priority />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><Calendar className="h-16 w-16" /></div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${EVENT_TYPE_PILL_CLASSES[event.eventType as EventType] ?? "bg-muted"}`}>
            {getEventTypeLabel(event.eventType, locale)}
          </span>
          {event.isOfficial && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">
              <ShieldCheck className="h-3.5 w-3.5" /> Geverifieerd door Cards Center
            </span>
          )}
        </div>
      </div>

      <h1 className="mt-5 text-3xl font-bold text-foreground">{event.title}</h1>

      <div className="mt-2 space-y-1 text-muted-foreground">
        <p className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0" /> {dateLabel}</p>
        <p className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" />
          {event.venueName}, {event.street} {event.houseNumber}, {event.postalCode} {event.city}
          <CountryFlag code={event.country} size="sm" /> {getEventCountryName(event.country, locale)}
        </p>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
        {/* Main */}
        <div className="space-y-6">
          {/* Tickets — belangrijkste blok */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-foreground">
              <Ticket className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Tickets
            </h2>

            {event.entryType === "FREE" ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <Ticket className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">Gratis entree</p>
                  <p className="text-sm text-muted-foreground">Je hebt geen ticket nodig — kom langs!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {ticketList.map((t, i) => (
                    <div key={i} className="relative aspect-[847/350] w-full overflow-hidden">
                      {/* ticket-achtergrond (perforatie op ~70%) */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/images/cosmetics/blank-ticket.webp"
                        alt=""
                        aria-hidden
                        className="pointer-events-none absolute inset-0 h-full w-full select-none"
                      />
                      <div className="absolute inset-0 flex items-stretch">
                        {/* hoofdgedeelte: naam + beschrijving + servicekosten */}
                        <div className="flex min-w-0 basis-[70%] flex-col justify-center gap-0.5 py-3 pl-[8%] pr-2">
                          <p className="truncate text-base font-bold text-slate-900">{t.name}</p>
                          {t.description && <p className="line-clamp-2 text-xs leading-snug text-slate-600">{t.description}</p>}
                          {t.serviceFee != null && t.serviceFee > 0 && (
                            <p className="text-[11px] text-slate-500">+ {formatEuro(t.serviceFee)} servicekosten</p>
                          )}
                        </div>
                        {/* stub: prijs */}
                        <div className="flex basis-[30%] items-center justify-center pr-[4%]">
                          <p className="text-lg font-extrabold leading-tight text-slate-900">{formatEuro(t.price)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {event.registrationUrl ? (
                  <a
                    href={event.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Tickets kopen <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Tickets zijn aan de deur verkrijgbaar.</p>
                )}
              </div>
            )}

            {/* Praktische capaciteit-info (tafels staan bij "Voor standhouders") */}
            {event.maxVisitors && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-foreground">
                  <Users className="h-4 w-4 text-muted-foreground" /> Max. {event.maxVisitors} bezoekers
                </span>
              </div>
            )}
          </div>

          {event.description && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Over dit evenement</h2>
              <div
                className="prose prose-sm max-w-none text-foreground dark:prose-invert [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </div>
          )}

          {/* Video */}
          {video && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Video</h2>
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
                <iframe
                  src={video.embedUrl}
                  title="Evenement-video"
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
          )}

          {/* Impressiefoto's */}
          {galleryImages.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Impressie</h2>
              <EventGallery images={galleryImages} />
            </div>
          )}

          {/* Faciliteiten */}
          {activeFacilities.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Faciliteiten</h2>
              <div className="flex flex-wrap gap-2">
                {activeFacilities.map((k) => {
                  const Icon = FACILITY_ICONS[k];
                  return (
                    <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-foreground">
                      <Icon className="h-4 w-4" /> {FACILITY_LABELS_NL[k]}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standhouders */}
          {hasVendor && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Store className="h-5 w-5" /> Voor standhouders</h2>
              {vendorOptions.length > 0 && (
                <ul className="mt-2 divide-y divide-border">
                  {vendorOptions.map((v, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{v.name}</p>
                        {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-foreground">{formatEuro(v.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {event.totalTables && (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-foreground">
                  <Table2 className="h-4 w-4 text-muted-foreground" /> {event.totalTables} tafels beschikbaar
                </span>
              )}
              {event.vendorInfo && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{event.vendorInfo}</p>}
            </div>
          )}

          {/* Toernooi */}
          {event.eventType === "OP_TOERNOOI" && (event.tournamentFormat || event.prizePool || event.isSanctioned) && (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-700/40 dark:bg-amber-950/30">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Trophy className="h-5 w-5" /> Toernooi-informatie</h2>
              <dl className="mt-2 space-y-1 text-sm">
                {event.tournamentFormat && <div><dt className="inline font-medium text-foreground">Format: </dt><dd className="inline text-muted-foreground">{event.tournamentFormat}</dd></div>}
                {event.prizePool && <div><dt className="inline font-medium text-foreground">Prijzenpot: </dt><dd className="inline text-muted-foreground">{event.prizePool}</dd></div>}
                {event.isSanctioned && <p className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" /> Officieel gesanctioneerd (TCG+)</p>}
              </dl>
            </div>
          )}

          {/* Kaart */}
          {event.lat !== null && event.lng !== null && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Locatie op de kaart</h2>
              <EventMap
                locale={locale}
                events={[{
                  id: event.id,
                  title: event.title,
                  lat: event.lat,
                  lng: event.lng,
                  venueName: event.venueName,
                  street: event.street,
                  houseNumber: event.houseNumber,
                  postalCode: event.postalCode,
                  city: event.city,
                  startTime: event.startTime.toISOString(),
                  endTime: event.endTime.toISOString(),
                  timezone: event.timezone,
                }]}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="mt-6 space-y-4 lg:mt-0">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organisator</p>
            {hasOrganizerOverride ? (
              <p className="mt-1 font-semibold text-foreground">{organizerDisplay}</p>
            ) : (
              <Link href={`/verkoper/${event.organizer.id}`} className="mt-1 block font-semibold text-foreground hover:text-primary">
                {organizerDisplay}
              </Link>
            )}

            {event.organizerWebsite && (
              <a
                href={event.organizerWebsite}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Globe className="h-3.5 w-3.5" /> Website <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.organizer.isTrustedEventOrganizer && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Star className="h-3 w-3" /> Vertrouwd
                </span>
              )}
              {event.organizer.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  <ShieldCheck className="h-3 w-3" /> ID
                </span>
              )}
            </div>

            {hasOrganizerOverride && (
              <Link href={`/verkoper/${event.organizer.id}`} className="mt-2 block text-xs text-muted-foreground hover:text-foreground">
                Geplaatst via {event.organizer.displayName ?? "account"}
              </Link>
            )}
          </div>

          {/* Andere events van deze organisator */}
          {otherEvents.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Andere events van {organizerDisplay}
              </p>
              <ul className="space-y-2">
                {otherEvents.map((o) => (
                  <li key={o.id}>
                    <Link href={`/evenementen/${o.id}`} className="group flex items-center gap-3">
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {o.coverImage ? (
                          <Image src={o.coverImage} alt="" fill className="object-cover" sizes="48px" unoptimized />
                        ) : (
                          <span className="flex h-full items-center justify-center"><Calendar className="h-5 w-5 text-muted-foreground" /></span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{o.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nl-NL", { timeZone: o.timezone, day: "numeric", month: "short" }).format(o.startTime)} · {o.city}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <EventReportButton eventId={event.id} />
        </aside>
      </div>
    </PageContainer>
  );
}
