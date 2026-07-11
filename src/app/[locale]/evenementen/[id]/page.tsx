import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import Image from "next/image";
import {
  Calendar, CalendarPlus, Clock, MapPin, Navigation, Ticket, ExternalLink, ShieldCheck, Star, Users, Store, Globe, Table2, Ruler,
  Gamepad2, Repeat, Tag, Car, Coffee, Toilet, Wifi, CreditCard, Accessibility, Shirt, Trophy, Baby,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { getEventTypeLabel, EVENT_TYPE_PILL_CLASSES, FACILITY_LABELS_NL, type EventType, type FacilityKey } from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import { formatEventDateRange, formatEventTime } from "@/lib/events/timezones";
import { parseEventVideo } from "@/lib/events/video";
import { formatEuro } from "@/lib/events/format";
import { CountryFlag } from "@/components/ui/country-flag";
import { EventMap } from "@/components/events/event-map";
import { EventDetailTabs } from "@/components/events/event-detail-tabs";
import { EventRsvpButtons } from "@/components/events/event-rsvp-buttons";
import { EventAttendeeList } from "@/components/events/event-attendee-list";
import { EventVendorGrid } from "@/components/events/event-vendor-grid";
import { EventVendorRequestCta } from "@/components/events/event-vendor-request-cta";
import { EventGallery } from "@/components/events/event-gallery";
import { EventFlyer } from "@/components/events/event-flyer";
import { EventReportButton } from "@/components/events/event-report-button";
import { ContactSellerButton } from "@/components/message/contact-seller-button";
import { SocialShare } from "@/components/ui/social-share";
import { parseSocialLinks, detectSocialPlatform } from "@/lib/events/socials";
import { getBuyerLocation } from "@/lib/shipping/filter";
import { coordForPostcode, haversineDistanceKm, formatDistance } from "@/lib/distance";
import { SocialIcon } from "@/components/events/social-icon";

const FACILITY_ICONS: Record<FacilityKey, React.ComponentType<{ className?: string }>> = {
  canPlay: Gamepad2, canTrade: Repeat, canSell: Tag, hasParking: Car, hasFood: Coffee,
  hasToilets: Toilet, hasWifi: Wifi, cardPayment: CreditCard, wheelchairAccessible: Accessibility, hasCloakroom: Shirt, childFriendly: Baby,
};
const FACILITY_ORDER: FacilityKey[] = [
  "canPlay", "canTrade", "canSell", "hasParking", "hasFood", "hasToilets", "hasWifi", "cardPayment", "wheelchairAccessible", "hasCloakroom", "childFriendly",
];

/** Consistente sectie-kop: klein indigo kicker-label + titel. Eén systeem
 *  voor alle secties geeft de pagina rust en hiërarchie. */
function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">{kicker}</p>
      <h2 className="mt-0.5 text-xl font-bold tracking-tight text-foreground">{title}</h2>
    </div>
  );
}

/** Meta-tegel in de hero: icoon in getint vierkant + label + waarde. */
function HeroMetaTile({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-foreground">{children}</div>
      </div>
    </div>
  );
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const session = await auth();

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      organizer: {
        select: {
          id: true, displayName: true, avatarUrl: true, isVerified: true, isIbanVerified: true,
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
  const socialLinks = parseSocialLinks(event.socialLinks);

  // Route via Google Maps (universal URL, geen API-key): coördinaten als de
  // geocode gelukt is, anders het volledige adres als bestemming.
  const routeDestination =
    event.lat !== null && event.lng !== null
      ? `${event.lat},${event.lng}`
      : `${event.street} ${event.houseNumber}, ${event.postalCode} ${event.city}, ${getEventCountryName(event.country, "nl")}`;
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(routeDestination)}`;

  const viewerId = session?.user?.id ?? null;
  const isOrganizer = viewerId === event.organizer.id;
  const eventOver = event.endTime <= new Date();

  // "± X km bij jou vandaan" — hemelsbreed vanaf de PC4-centroïde van de
  // kijker (alleen NL-postcodes in de dataset; anders geen regel).
  const buyerLoc = await getBuyerLocation();
  const buyerCoord = buyerLoc ? coordForPostcode(buyerLoc.country, buyerLoc.postalCode) : null;
  const distanceFromViewerKm =
    buyerCoord && event.lat !== null && event.lng !== null
      ? haversineDistanceKm(buyerCoord, [event.lat, event.lng])
      : null;
  const rsvpUserSelect = { select: { id: true, displayName: true, avatarUrl: true, city: true } } as const;

  // Andere events + RSVP- en standhouder-data in één batch.
  const [otherEvents, rsvpCounts, goingRows, interestedRows, viewerRsvp, approvedVendorRows, viewerVendorRequest] = await Promise.all([
    prisma.event.findMany({
      where: {
        organizerId: event.organizer.id,
        status: "LIVE",
        endTime: { gte: new Date() },
        id: { not: event.id },
      },
      orderBy: { startTime: "asc" },
      take: 4,
      select: { id: true, title: true, startTime: true, timezone: true, coverImage: true, city: true },
    }),
    prisma.eventRsvp.groupBy({ by: ["status"], where: { eventId: event.id }, _count: true }),
    prisma.eventRsvp.findMany({
      where: { eventId: event.id, status: "GOING" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { user: rsvpUserSelect },
    }),
    prisma.eventRsvp.findMany({
      where: { eventId: event.id, status: "INTERESTED" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { user: rsvpUserSelect },
    }),
    viewerId
      ? prisma.eventRsvp.findUnique({
          where: { eventId_userId: { eventId: event.id, userId: viewerId } },
          select: { status: true },
        })
      : Promise.resolve(null),
    prisma.eventVendorRequest.findMany({
      where: { eventId: event.id, status: "APPROVED" },
      orderBy: { decidedAt: "asc" },
      take: 60,
      select: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true, companyName: true, profileBanner: true, isVerified: true },
        },
      },
    }),
    viewerId
      ? prisma.eventVendorRequest.findUnique({
          where: { eventId_userId: { eventId: event.id, userId: viewerId } },
          select: { id: true, status: true },
        })
      : Promise.resolve(null),
  ]);

  const goingTotal = rsvpCounts.find((c) => c.status === "GOING")?._count ?? 0;
  const interestedTotal = rsvpCounts.find((c) => c.status === "INTERESTED")?._count ?? 0;
  const goingUsers = goingRows.map((r) => r.user);
  const interestedUsers = interestedRows.map((r) => r.user);
  // Avatar-stack: aanwezigen eerst, dan geïnteresseerden.
  const rsvpStack = [...goingUsers, ...interestedUsers].slice(0, 6);

  const approvedVendors = approvedVendorRows.map((r) => ({
    userId: r.user.id,
    displayName: r.user.displayName,
    companyName: r.user.companyName,
    avatarUrl: r.user.avatarUrl,
    profileBanner: r.user.profileBanner,
    isVerified: r.user.isVerified,
  }));

  // ── Tab-panelen (hybride layout: hero + tickets altijd zichtbaar, rest in tabs) ──

  const panelCard = "rounded-xl border border-border bg-card p-4 sm:p-5";
  const hasTournamentInfo =
    event.eventType === "OP_TOERNOOI" && (event.tournamentFormat || event.prizePool || event.isSanctioned);

  const infoPanel =
    event.description || activeFacilities.length > 0 || hasTournamentInfo ? (
      <div className="space-y-6">
        {event.description && (
          <div className={panelCard}>
            <SectionHeading kicker="Beschrijving" title="Over dit evenement" />
            <div
              className="prose prose-sm max-w-none text-foreground dark:prose-invert [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: event.description }}
            />
          </div>
        )}
        {activeFacilities.length > 0 && (
          <div className={panelCard}>
            <SectionHeading kicker="Voorzieningen" title="Faciliteiten" />
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
        {hasTournamentInfo && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-700/40 dark:bg-amber-950/30">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Trophy className="h-5 w-5" /> Toernooi-informatie</h2>
            <dl className="mt-2 space-y-1 text-sm">
              {event.tournamentFormat && <div><dt className="inline font-medium text-foreground">Format: </dt><dd className="inline text-muted-foreground">{event.tournamentFormat}</dd></div>}
              {event.prizePool && <div><dt className="inline font-medium text-foreground">Prijzenpot: </dt><dd className="inline text-muted-foreground">{event.prizePool}</dd></div>}
              {event.isSanctioned && <p className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" /> Officieel gesanctioneerd (TCG+)</p>}
            </dl>
          </div>
        )}
      </div>
    ) : null;

  const locationPanel = (
    <div className={panelCard}>
      <SectionHeading kicker="Adres" title="Locatie & route" />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 shrink-0" />
        {event.venueName}, {event.street} {event.houseNumber}, {event.postalCode} {event.city}
        <CountryFlag code={event.country} size="sm" /> {getEventCountryName(event.country, locale)}
      </p>
      {distanceFromViewerKm !== null && (
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Navigation className="h-4 w-4 shrink-0" />
          ± {formatDistance(distanceFromViewerKm)} bij jou vandaan (hemelsbreed)
        </p>
      )}
      {event.lat !== null && event.lng !== null && (
        <div className="mt-3">
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
      <a
        href={routeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        <Navigation className="h-4 w-4" /> Plan je route
      </a>
    </div>
  );

  const visitorsPanel = (
    <div className={panelCard}>
      <SectionHeading kicker="Community" title="Wie komt er?" />
      <EventAttendeeList
        going={goingUsers}
        interested={interestedUsers}
        goingTotal={goingTotal}
        interestedTotal={interestedTotal}
      />
    </div>
  );

  const vendorsPanel = (
    <div className="space-y-6">
      <div className={panelCard}>
        <SectionHeading kicker="Huren & reserveren" title="Voor standhouders" />
        {hasVendor ? (
          <>
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
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">De organisator heeft nog geen standhouder-informatie toegevoegd.</p>
        )}
      </div>

      <div className={panelCard}>
        <SectionHeading kicker="Aanwezig" title="Standhouders op dit event" />
        <div className="mt-3">
          {approvedVendors.length > 0 ? (
            <EventVendorGrid vendors={approvedVendors} />
          ) : (
            <p className="text-sm text-muted-foreground">Nog geen standhouders aangemeld.</p>
          )}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <EventVendorRequestCta
            eventId={event.id}
            viewerStatus={(viewerVendorRequest?.status as "PENDING" | "APPROVED" | "REJECTED" | undefined) ?? null}
            requestId={viewerVendorRequest?.id ?? null}
            isLoggedIn={!!viewerId}
            isOrganizer={isOrganizer}
            eventOver={eventOver}
          />
        </div>
      </div>
    </div>
  );

  const mediaPanel =
    video || galleryImages.length > 0 ? (
      <div className="space-y-6">
        {video && (
          <div className={panelCard}>
            <SectionHeading kicker="Media" title="Video" />
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
        {galleryImages.length > 0 && (
          <div className={panelCard}>
            <SectionHeading kicker="Media" title="Impressie" />
            <EventGallery images={galleryImages} />
          </div>
        )}
      </div>
    ) : null;

  return (
    <PageContainer width="default" className="py-8">
      <Link href="/evenementen" className="text-sm text-muted-foreground hover:text-foreground">← Terug naar evenementen</Link>

      {/* ── Hero: banner + kerninfo in één omkaderde kaart ── */}
      <section className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="relative aspect-[3/1] w-full bg-muted">
          {event.coverImage ? (
            <Image src={event.coverImage} alt={event.title} fill className="object-cover" sizes="100vw" unoptimized priority />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground"><Calendar className="h-16 w-16" /></div>
          )}
          {/* subtiele diepte onderaan de banner */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
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

        <div className="p-5 sm:p-7">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{event.title}</h1>

          {/* Meta-tegels: datum + locatie */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <HeroMetaTile icon={Calendar} label="Datum & tijd">
              <p>{dateLabel}</p>
              {event.earlyAccessTime && (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  <Clock className="h-3 w-3" /> Vroege toegang vanaf {formatEventTime(event.earlyAccessTime, event.timezone, locale === "en" ? "en-GB" : "nl-NL")}
                </p>
              )}
            </HeroMetaTile>
            <HeroMetaTile icon={MapPin} label="Locatie">
              <p>{event.venueName}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {event.street} {event.houseNumber}, {event.postalCode} {event.city}
                <CountryFlag code={event.country} size="xs" />
                {distanceFromViewerKm !== null && <span>· ± {formatDistance(distanceFromViewerKm)}</span>}
              </p>
            </HeroMetaTile>
          </div>

          {/* Actie-rij: RSVP links, agenda/route rechts */}
          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 lg:flex-row lg:items-center lg:justify-between">
            <EventRsvpButtons
              eventId={event.id}
              viewerStatus={(viewerRsvp?.status as "INTERESTED" | "GOING" | undefined) ?? null}
              isLoggedIn={!!viewerId}
              isOrganizer={isOrganizer}
              eventOver={eventOver}
              interestedCount={interestedTotal}
              goingCount={goingTotal}
              stack={rsvpStack}
            />
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/events/${event.id}/ics`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <CalendarPlus className="h-4 w-4" /> Zet in mijn agenda
              </a>
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <Navigation className="h-4 w-4" /> Plan je route
              </a>
              <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
              <SocialShare title={event.title} />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
        {/* Main */}
        <div className="space-y-6">
          {/* ── Entree: eigen getinte sectie ── */}
          <section className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/70 via-card to-card p-5 shadow-card dark:border-indigo-800/40 dark:from-indigo-950/30 sm:p-6">
            <SectionHeading kicker="Toegang" title="Tickets & entree" />

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
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
                        <div className="flex min-w-0 basis-[70%] flex-col justify-center gap-0.5 py-2 pl-[8%] pr-1.5">
                          <p className="truncate text-sm font-bold text-slate-900 sm:text-base">{t.name}</p>
                          {t.description && <p className="line-clamp-1 text-[10px] leading-snug text-slate-600">{t.description}</p>}
                          {t.serviceFee != null && t.serviceFee > 0 && (
                            <p className="text-[9px] text-slate-500">+ {formatEuro(t.serviceFee)} servicekosten</p>
                          )}
                        </div>
                        {/* stub: prijs */}
                        <div className="flex basis-[30%] items-center justify-center pr-[4%]">
                          <p className="whitespace-nowrap text-sm font-extrabold leading-none text-slate-900 sm:text-xl">{formatEuro(t.price)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {event.registrationUrl ? (
                    <a
                      href={event.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Tickets kopen <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Ticket className="h-4 w-4" /> Tickets zijn aan de deur verkrijgbaar.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Capaciteit (tafels staan bij "Standhouders") */}
            {(event.maxVisitors || event.venueSizeM2) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-indigo-200/60 pt-4 dark:border-indigo-800/40">
                {event.maxVisitors && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground">
                    <Users className="h-4 w-4 text-muted-foreground" /> Max. {event.maxVisitors} bezoekers
                  </span>
                )}
                {event.venueSizeM2 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground">
                    <Ruler className="h-4 w-4 text-muted-foreground" /> {event.venueSizeM2} m² vloeroppervlak
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Overige secties in tabs (hybride layout) */}
          <EventDetailTabs
            info={infoPanel}
            location={locationPanel}
            visitors={visitorsPanel}
            vendors={vendorsPanel}
            media={mediaPanel}
            visitorsCount={goingTotal + interestedTotal}
            vendorsCount={approvedVendors.length}
          />
        </div>

        {/* Sidebar */}
        <aside className="mt-6 space-y-4 lg:mt-0">
          {/* Flyer */}
          {event.flyerImage && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border bg-muted/40 px-4 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">Flyer</p>
              </div>
              <div className="p-4">
                <EventFlyer src={event.flyerImage} title={event.title} />
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/40 px-4 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">Organisator</p>
            </div>
            <div className="p-4">
            <div className="flex items-center gap-3">
              {event.organizer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.organizer.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {organizerDisplay.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                {hasOrganizerOverride ? (
                  <p className="truncate font-semibold text-foreground">{organizerDisplay}</p>
                ) : (
                  <Link href={`/verkoper/${event.organizer.id}`} className="block truncate font-semibold text-foreground hover:text-primary">
                    {organizerDisplay}
                  </Link>
                )}
                <div className="mt-0.5 flex flex-wrap gap-1.5">
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
              </div>
            </div>

            {(event.organizerWebsite || socialLinks.length > 0) && (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                {event.organizerWebsite && (
                  <a
                    href={event.organizerWebsite}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" /> Website <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {socialLinks.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {socialLinks.map((url) => {
                      const { label, platform } = detectSocialPlatform(url);
                      return (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <SocialIcon platform={platform} className="h-3.5 w-3.5" /> {label} <ExternalLink className="h-3 w-3" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {hasOrganizerOverride && (
              <Link href={`/verkoper/${event.organizer.id}`} className="mt-2 block text-xs text-muted-foreground hover:text-foreground">
                Geplaatst via {event.organizer.displayName ?? "account"}
              </Link>
            )}

            {/* Vraag stellen via chat — alleen ingelogd en niet aan jezelf */}
            {session?.user?.id && session.user.id !== event.organizer.id && (
              <div className="mt-3">
                <ContactSellerButton sellerId={event.organizer.id} label="Stel een vraag" variant="primary" />
              </div>
            )}
            </div>
          </div>

          {/* Andere events van deze organisator */}
          {otherEvents.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border bg-muted/40 px-4 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
                  Meer van {organizerDisplay}
                </p>
              </div>
              <div className="p-4">
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
            </div>
          )}

          <EventReportButton eventId={event.id} />
        </aside>
      </div>
    </PageContainer>
  );
}
