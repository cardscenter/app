import { useTranslations } from "next-intl";
import { Clock, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ShopEventListItem } from "@/lib/shop-events/queries";
import { formatEventTime, formatPrice } from "@/lib/shop-events/format";
import { PunchCard } from "@/components/ploy/punch-card";
import { EventTypePill } from "./event-type-pill";

const TZ = "Europe/Amsterdam";
function part(d: Date, locale: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nl-NL", { timeZone: TZ, ...opts }).format(d);
}

/**
 * Event-kaart in de catalogus (design-pass): punch-card met type-pil, grote
 * dag in de display-letter, titel, tijd en plekken, onderin prijs en actie.
 */
export function EventCatalogCard({ event, locale }: { event: ShopEventListItem; locale: string }) {
  const t = useTranslations("shopEvents");
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const a = event.availability;
  const spots = a.spotsLeft === null ? t("spotsUnlimited") : a.full ? (a.waitlistCount > 0 ? t("fullWithWaitlist", { count: a.waitlistCount }) : t("full")) : t("spotsLeft", { count: a.spotsLeft });

  return (
    <Link href={`/evenementen/${event.id}`} className="group block h-full no-underline">
      <PunchCard className="flex h-full flex-col bg-white p-6 transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)]" dot="var(--border)">
        <div className="flex items-center justify-between gap-2">
          <EventTypePill name={event.typeName} color={event.typeColor} />
          {event.gameName && <span className="truncate text-xs font-semibold text-[var(--foreground)]/50">{event.gameName}</span>}
        </div>
        <div className="mt-6 flex items-end gap-3">
          <span className="cc-display text-6xl leading-none text-[var(--foreground)]">{part(start, locale, { day: "numeric" })}</span>
          <span className="pb-1 text-sm font-semibold leading-tight text-[var(--foreground)]/70">
            {part(start, locale, { weekday: "long" })}
            <br />
            {part(start, locale, { month: "long" })}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-semibold leading-[1.2] tracking-[-0.03em] text-[var(--foreground)]">{event.title}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--foreground)]/65">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {formatEventTime(start, locale)} - {formatEventTime(end, locale)}
          </span>
          <span className={`inline-flex items-center gap-1.5 ${a.full ? "font-semibold text-[var(--primary)]" : ""}`}>
            <Users className="size-3.5" />
            {spots}
          </span>
          {event.minAge !== null && <span>{t("minAge", { age: event.minAge })}</span>}
        </div>
        {event.countsForLeague && <p className="mt-2 text-xs font-semibold text-[var(--pastel-green-ink)]">{t("countsForLeague")}</p>}
        <div className="mt-auto flex items-center justify-between pt-6">
          <span className="text-base font-bold text-[var(--foreground)]">{formatPrice(event.price, locale)}</span>
          <span className="text-sm font-semibold text-[var(--primary)]">{event.window === "open" ? t("register") : t("view")} →</span>
        </div>
      </PunchCard>
    </Link>
  );
}
