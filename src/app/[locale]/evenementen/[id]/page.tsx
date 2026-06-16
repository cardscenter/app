import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import Image from "next/image";
import {
  Calendar, MapPin, Ticket, ExternalLink, ShieldCheck, Star, Users, Baby, Store,
  Gamepad2, Repeat, Tag, Car, Coffee, Toilet, Wifi, CreditCard, Accessibility, Shirt, Trophy,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { getEventTypeLabel, EVENT_TYPE_PILL_CLASSES, FACILITY_LABELS_NL, type EventType, type FacilityKey } from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import { formatEventDateRange } from "@/lib/events/timezones";
import { CountryFlag } from "@/components/ui/country-flag";
import { EventMap } from "@/components/events/event-map";
import { EventReportButton } from "@/components/events/event-report-button";

const FACILITY_ICONS: Record<FacilityKey, React.ComponentType<{ className?: string }>> = {
  canPlay: Gamepad2, canTrade: Repeat, canSell: Tag, hasParking: Car, hasFood: Coffee,
  hasToilets: Toilet, hasWifi: Wifi, cardPayment: CreditCard, wheelchairAccessible: Accessibility, hasCloakroom: Shirt,
};
const FACILITY_ORDER: FacilityKey[] = [
  "canPlay", "canTrade", "canSell", "hasParking", "hasFood", "hasToilets", "hasWifi", "cardPayment", "wheelchairAccessible", "hasCloakroom",
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
  const cur = event.entryCurrency ?? "EUR";

  const activeFacilities = FACILITY_ORDER.filter((k) => event[k as keyof typeof event] as boolean);

  // Ticket-soorten (TIERS)
  let tiers: { name: string; price: number }[] = [];
  if (event.entryType === "PAID" && event.entryPriceMode === "TIERS" && event.ticketTypes) {
    try {
      const parsed = JSON.parse(event.ticketTypes);
      if (Array.isArray(parsed)) tiers = parsed;
    } catch { /* negeer */ }
  }

  const entryLine = (() => {
    if (event.entryType === "FREE") return "Gratis entree";
    if (event.entryPriceMode === "TIERS") return null; // toont aparte lijst
    const prefix = event.entryPriceMode === "FROM" ? "vanaf " : "";
    return `Entree: ${prefix}${cur} ${event.entryPrice ?? ""}`;
  })();

  let vendorOptions: { name: string; price: number }[] = [];
  if (event.vendorOptions) {
    try {
      const parsed = JSON.parse(event.vendorOptions);
      if (Array.isArray(parsed)) vendorOptions = parsed;
    } catch { /* negeer */ }
  }
  const hasVendor = vendorOptions.length > 0 || !!event.vendorInfo;

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
          {event.description && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Over dit evenement</h2>
              <div
                className="prose prose-sm max-w-none text-foreground dark:prose-invert [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </div>
          )}

          {/* Entree + tickets */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Ticket className="h-5 w-5 text-muted-foreground" />
              {entryLine && <span className="font-medium text-foreground">{entryLine}</span>}
              {event.maxVisitors && (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> max. {event.maxVisitors} bezoekers
                </span>
              )}
              {event.registrationUrl && (
                <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">
                  Aanmelden / tickets <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            {tiers.length > 0 && (
              <ul className="mt-3 divide-y divide-border border-t border-border">
                {tiers.map((t, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-foreground">{t.name}</span>
                    <span className="font-medium text-foreground">{t.price === 0 ? "Gratis" : `${cur} ${t.price.toFixed(2)}`}</span>
                  </li>
                ))}
              </ul>
            )}

            {event.childrenFreeUntilAge && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <Baby className="h-4 w-4" /> Kinderen t/m {event.childrenFreeUntilAge} jaar gratis
              </p>
            )}
          </div>

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
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {vendorOptions.map((v, i) => (
                    <span key={i} className="rounded-full bg-muted px-3 py-1.5 text-foreground">
                      {v.name}: {v.price === 0 ? "gratis" : `${cur} ${v.price.toFixed(2)}`}
                    </span>
                  ))}
                </div>
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
              <EventMap events={[{ id: event.id, title: event.title, lat: event.lat, lng: event.lng, city: event.city, startTime: event.startTime.toISOString() }]} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="mt-6 space-y-4 lg:mt-0">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organisator</p>
            <Link href={`/verkoper/${event.organizer.id}`} className="mt-1 block font-semibold text-foreground hover:text-primary">
              {event.organizer.displayName ?? "Onbekend"}
            </Link>
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
          </div>

          <EventReportButton eventId={event.id} />
        </aside>
      </div>
    </PageContainer>
  );
}
