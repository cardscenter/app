import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CalendarDays, Clock, Users, ChevronRight } from "lucide-react";
import type { ShopEventListItem } from "@/lib/shop-events/queries";
import { formatEventDateShort, formatEventTime, formatPrice } from "@/lib/shop-events/format";
import { EventTypePill } from "./event-type-pill";

/**
 * Lijst-rij voor een winkel-event: datumblok links, titel + type + spel,
 * rechts prijs en plekken. Server component (geen state).
 */
export function ShopEventRow({ event, locale }: { event: ShopEventListItem; locale: string }) {
  const t = useTranslations("shopEvents");
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const a = event.availability;
  const spots =
    a.spotsLeft === null
      ? t("spotsUnlimited")
      : a.full
        ? a.waitlistCount > 0
          ? t("fullWithWaitlist", { count: a.waitlistCount })
          : t("full")
        : t("spotsLeft", { count: a.spotsLeft });
  const dayParts = formatEventDateShort(start, locale).split(" ");

  return (
    <Link
      href={`/evenementen/${event.id}`}
      className="group flex items-stretch gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover sm:gap-5 sm:p-5"
    >
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-muted py-2 text-center sm:w-20">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{dayParts[0]}</span>
        <span className="text-2xl font-bold leading-none text-foreground">{dayParts[1]}</span>
        <span className="text-[11px] font-medium uppercase text-muted-foreground">{dayParts[2]}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <EventTypePill name={event.typeName} color={event.typeColor} />
          {event.gameName && <span className="text-xs text-muted-foreground">{event.gameName}</span>}
          {event.countsForLeague && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t("countsForLeague")}</span>
          )}
        </div>
        <h3 className="mt-1.5 truncate text-base font-semibold text-foreground group-hover:text-primary sm:text-lg">{event.title}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {formatEventTime(start, locale)} - {formatEventTime(end, locale)}
          </span>
          <span className={`inline-flex items-center gap-1.5 ${a.full ? "text-amber-600 dark:text-amber-400" : ""}`}>
            <Users className="size-3.5" />
            {spots}
          </span>
          {event.minAge !== null && <span>{t("minAge", { age: event.minAge })}</span>}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between">
        <span className="text-base font-bold text-foreground sm:text-lg">{formatPrice(event.price, locale)}</span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          <span className="hidden sm:inline">{event.window === "open" ? t("register") : t("view")}</span>
          <ChevronRight className="size-4" />
        </span>
      </div>
      <CalendarDays className="sr-only" />
    </Link>
  );
}
