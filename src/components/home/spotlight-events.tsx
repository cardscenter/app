import Image from "next/image";
import { Calendar, MapPin, Ticket, CalendarDays, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AnimatedSection } from "@/components/home/animated-section";
import { HomeCarousel, CarouselSlide } from "@/components/home/home-carousel";
import { getEventTypeLabel, EVENT_TYPE_PILL_CLASSES, type EventType } from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import { formatEventDateRange } from "@/lib/events/timezones";
import { formatEuro } from "@/lib/events/format";
import { CountryFlag } from "@/components/ui/country-flag";
import type { EventListItem } from "@/components/events/event-view-types";

/** Homepage-rij met betaalde (HOMEPAGE_SPOTLIGHT) evenementen. Compacte
 *  verticale tegels in een carousel, consistent met de andere homepage-rijen. */
export function SpotlightEvents({
  items,
  locale,
  bgClass,
}: {
  items: EventListItem[];
  locale: string;
  bgClass: string;
}) {
  if (items.length === 0) return null;
  const intlLocale = locale === "en" ? "en-GB" : "nl-NL";

  return (
    <section className={`py-12 lg:py-16 ${bgClass}`}>
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <AnimatedSection>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                <CalendarDays className="size-4" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-foreground sm:text-xl">Uitgelichte evenementen</h2>
                <p className="text-sm text-muted-foreground">Beurzen en events bij jou in de buurt en daarbuiten.</p>
              </div>
            </div>
            <Link
              href="/evenementen"
              className="hidden shrink-0 items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 sm:inline-flex"
            >
              Alle evenementen <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-6">
            <HomeCarousel fadeFromClass={bgClass === "bg-card" ? "from-card" : "from-background"}>
              {items.map((event) => (
                <CarouselSlide key={event.id}>
                  <Link
                    href={`/evenementen/${event.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-amber-300 bg-card shadow-card ring-1 ring-amber-300 transition hover:shadow-card-hover dark:border-amber-500/60 dark:ring-amber-500/40"
                  >
                    <div className="relative aspect-[16/9] w-full bg-muted">
                      {event.coverImage ? (
                        <Image src={event.coverImage} alt="" fill className="object-cover" sizes="280px" unoptimized />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Calendar className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                      <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVENT_TYPE_PILL_CLASSES[event.eventType as EventType] ?? "bg-muted"}`}>
                        {getEventTypeLabel(event.eventType, locale)}
                      </span>
                      <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground group-hover:text-primary">
                        {event.title}
                      </h3>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {formatEventDateRange(new Date(event.startTime), new Date(event.endTime), event.timezone, intlLocale)}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" /> {event.city}
                        <CountryFlag code={event.country} size="sm" /> {getEventCountryName(event.country, locale)}
                      </p>
                      <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs">
                        <Ticket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className={event.entryType === "FREE" ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
                          {event.entryType === "FREE" ? "Gratis entree" : event.entryPrice != null ? formatEuro(event.entryPrice) : "Tickets"}
                        </span>
                      </p>
                    </div>
                  </Link>
                </CarouselSlide>
              ))}
            </HomeCarousel>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
