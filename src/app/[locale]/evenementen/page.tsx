import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { parseEventFilters, buildEventFilterWhere } from "@/lib/event-filters";
import { EVENT_BANNER_STORED_TYPE } from "@/lib/events/upsell-config";
import { getEventPriceLabel } from "@/lib/events/format";
import { getBlockedUserIds } from "@/lib/blocking";
import { getBuyerLocation } from "@/lib/shipping/filter";
import { coordForPostcode, haversineDistanceKm } from "@/lib/distance";
import { EventTabs, EventViewToggle } from "@/components/events/event-controls";
import { EventFilterSidebar } from "@/components/events/event-filter-sidebar";
import { EventsMobileFilters } from "@/components/events/events-mobile-filters";
import { EventCard, EventEmptyState, EventBanner } from "@/components/events/event-card";
import { EventCalendarMonth } from "@/components/events/event-calendar-month";
import { EventsLaunchBanner } from "@/components/events/events-launch-banner";
import { EventMap } from "@/components/events/event-map";
import type { EventListItem } from "@/components/events/event-view-types";

// Groepeer de (op startTime gesorteerde) lijst per maand voor sectie-koppen
// à la beurzen-agenda's ("Juli 2026"). Maand in de tijdzone van het event zelf.
function groupEventsByMonth(events: EventListItem[]) {
  const groups: Array<{ label: string; items: EventListItem[] }> = [];
  for (const e of events) {
    const raw = new Intl.DateTimeFormat("nl-NL", { timeZone: e.timezone, month: "long", year: "numeric" }).format(new Date(e.startTime));
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return groups;
}

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const filters = parseEventFilters(sp);

  const session = await auth();
  const blocked = await getBlockedUserIds(session?.user?.id);

  // Buyer-locatie voor de afstand-filter. Alleen bruikbaar als we de postcode
  // naar een coördinaat kunnen omzetten (momenteel NL-dataset).
  const buyerLoc = await getBuyerLocation();
  const buyerCoord = buyerLoc
    ? coordForPostcode(buyerLoc.country, buyerLoc.postalCode)
    : null;

  const now = new Date();
  const where: Prisma.EventWhereInput = {
    ...buildEventFilterWhere(filters),
    status: "LIVE",
    endTime: { gte: now },
    ...(blocked.size > 0 ? { organizerId: { notIn: [...blocked] } } : {}),
  };

  // Ongefilterd totaal voor de launch-banner (events.length is gefilterd + gecapt).
  const totalLive = await prisma.event.count({ where: { status: "LIVE", endTime: { gte: now } } });
  const LAUNCH_BANNER_MAX_EVENTS = 15;

  const rows = await prisma.event.findMany({
    where,
    orderBy: { startTime: "asc" },
    take: 300,
    // "Featured" op /evenementen = een actieve banner-upsell (CATEGORY_HIGHLIGHT).
    // De homepage-spotlight (HOMEPAGE_SPOTLIGHT) telt hier bewust niet mee.
    include: {
      upsells: {
        where: { type: EVENT_BANNER_STORED_TYPE, expiresAt: { gt: now } },
        select: { id: true },
        take: 1,
      },
    },
  });

  const toItem = (e: (typeof rows)[number]): EventListItem => ({
    id: e.id,
    title: e.title,
    eventType: e.eventType,
    venueName: e.venueName,
    street: e.street,
    houseNumber: e.houseNumber,
    postalCode: e.postalCode,
    city: e.city,
    country: e.country,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    earlyAccessTime: e.earlyAccessTime?.toISOString() ?? null,
    timezone: e.timezone,
    coverImage: e.coverImage,
    entryType: e.entryType,
    entryPrice: e.entryPrice,
    entryCurrency: e.entryCurrency,
    priceLabel: getEventPriceLabel(e),
    maxVisitors: e.maxVisitors,
    venueSizeM2: e.venueSizeM2,
    totalTables: e.totalTables,
    canPlay: e.canPlay,
    canTrade: e.canTrade,
    canSell: e.canSell,
    isOfficial: e.isOfficial,
    lat: e.lat,
    lng: e.lng,
    featured: e.upsells.length > 0,
  });

  let events: EventListItem[] = rows.map(toItem);

  // Afstand-filter (post-filter in JS — SQLite kent geen haversine). Vereist een
  // buyer-coördinaat; events zonder geocode vallen buiten een radius-selectie.
  if (filters.radius && buyerCoord) {
    const max = filters.radius;
    events = events.filter(
      (e) =>
        e.lat != null &&
        e.lng != null &&
        haversineDistanceKm(buyerCoord, [e.lat, e.lng]) <= max,
    );
  }

  // "Uitgelicht" — events met een actieve banner-upsell. Afgeleid uit de reeds
  // gefilterde lijst (dus ook radius-correct) zodat een betaald event zichtbaar
  // blijft wanneer een bezoeker filtert — mits het binnen het filter past.
  const featured: EventListItem[] = events.filter((e) => e.featured).slice(0, 8);

  const tabLabel = filters.tab === "beurzen" ? "beurzen" : "evenementen";

  return (
    <PageContainer width="wide" className="py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="sr-only">Pokémon-evenementen</h1>
          {/* Plain <img>: Next image-optimizer faalt op Railway (zie performance-pass) */}
          <img
            src="/images/PKMevents.png"
            alt="Pokémon Events"
            className="h-16 w-auto sm:h-20"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Beurzen, trade nights, toernooien en meetups in heel Europa.
          </p>
        </div>
        {session?.user?.id && (
          <Link
            href={filters.tab === "beurzen" ? "/evenementen/nieuw?type=BEURS" : "/evenementen/nieuw"}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> {filters.tab === "beurzen" ? "Beurs toevoegen" : "Evenement toevoegen"}
          </Link>
        )}
      </div>

      {/* Launch-banner — verdwijnt vanzelf zodra de kalender gevuld raakt */}
      {totalLive < LAUNCH_BANNER_MAX_EVENTS && <EventsLaunchBanner tab={filters.tab} />}

      {/* Tabs */}
      <div className="mt-5">
        <EventTabs />
      </div>

      {/* Uitgelicht */}
      {featured.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Uitgelicht</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {featured.map((e) => (
              <div key={e.id} className="w-[85vw] shrink-0 sm:w-[28rem]">
                <EventBanner event={e} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column: sidebar + content */}
      <div className="mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
        <aside className="hidden lg:block">
          <div className="lg:sticky lg:top-20">
            <EventFilterSidebar buyerHasPostcode={!!buyerCoord} />
          </div>
        </aside>

        <div className="relative min-w-0">
          {/* Pikachu piept over de bovenrand van de events-box (alleen desktop).
              De PNG is onderaan recht afgesneden; 1px tuck onder de box-rand verkoopt de illusie. */}
          <img
            src="/images/pikatop.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -top-[111px] left-1/2 hidden h-28 w-auto -translate-x-1/2 lg:block"
          />
          {/* Officiële event-logo's rechts op dezelfde box-rand (alleen desktop) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-[72px] right-5 hidden items-end gap-3 lg:flex"
          >
            <img src="/images/playlogo.png" alt="" className="h-14 w-auto" />
            <img src="/images/regionalslogo.png" alt="" className="h-16 w-auto" />
          </div>
          <div className="relative lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {events.length} {tabLabel}
              {events.length > 0 && (() => {
                const within30d = events.filter((e) => new Date(e.startTime).getTime() <= now.getTime() + 30 * 24 * 3600 * 1000).length;
                return within30d > 0 ? ` · ${within30d} in de komende 30 dagen` : "";
              })()}
            </p>
            <div className="flex items-center gap-2">
              <EventsMobileFilters buyerHasPostcode={!!buyerCoord} />
              <EventViewToggle />
            </div>
          </div>

          {events.length === 0 && filters.view !== "map" && filters.view !== "month" ? (
            <EventEmptyState message={`Geen ${tabLabel} gevonden. Pas je filters aan of voeg er zelf één toe.`} />
          ) : filters.view === "month" ? (
            <EventCalendarMonth events={events} />
          ) : filters.view === "map" ? (
            <EventMap
              locale={locale}
              events={events
                .filter((e) => e.lat != null && e.lng != null)
                .map((e) => ({
                  id: e.id,
                  title: e.title,
                  lat: e.lat as number,
                  lng: e.lng as number,
                  venueName: e.venueName,
                  street: e.street,
                  houseNumber: e.houseNumber,
                  postalCode: e.postalCode,
                  city: e.city,
                  startTime: e.startTime,
                  endTime: e.endTime,
                  timezone: e.timezone,
                  featured: e.featured,
                }))}
            />
          ) : (
            <div className="space-y-7">
              {groupEventsByMonth(events).map((group) => (
                <section key={group.label}>
                  <h3 className="mb-3 flex items-baseline gap-2 border-b border-border pb-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                    <span className="text-xs font-medium normal-case tracking-normal text-muted-foreground/70">
                      {group.items.length} {group.items.length === 1 ? "evenement" : "evenementen"}
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {group.items.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
