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
import { EventCard, EventEmptyState, EventBanner } from "@/components/events/event-card";
import { EventCalendarMonth } from "@/components/events/event-calendar-month";
import { EventMap } from "@/components/events/event-map";
import type { EventListItem } from "@/components/events/event-view-types";

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
          <h1 className="text-2xl font-bold text-foreground">Pokémon-evenementen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Beurzen, trade nights, toernooien en meetups in heel Europa.
          </p>
        </div>
        <Link
          href="/evenementen/nieuw"
          className="inline-flex items-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Evenement toevoegen
        </Link>
      </div>

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
        <aside className="mb-6 lg:mb-0">
          <div className="lg:sticky lg:top-20">
            <EventFilterSidebar buyerHasPostcode={!!buyerCoord} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {events.length} {tabLabel}
            </p>
            <EventViewToggle />
          </div>

          {events.length === 0 ? (
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
            <div className="space-y-3">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
