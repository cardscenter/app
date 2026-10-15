import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, Clock, MapPin, Users, Baby, Trophy, Stamp, ChevronLeft, CalendarPlus, Info } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/layout/page-container";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getShopEventDetail } from "@/lib/shop-events/queries";
import { getBookingEligibility } from "@/lib/event-eligibility";
import { needsSupervision } from "@/lib/age";
import { getHubSettings } from "@/lib/app-config";
import { formatEventDate, formatEventTime, formatPrice, formatEventDateShort } from "@/lib/shop-events/format";
import { formatShopAddress, PLATFORM } from "@/lib/platform-config";
import { EventTypePill } from "@/components/shop-events/event-type-pill";
import { RegistrationPanel } from "@/components/shop-events/registration-panel";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.shopEvent.findUnique({ where: { id }, select: { title: true, description: true, status: true } });
  if (!event || event.status === "DRAFT") return { title: "Cards Center" };
  return { title: `${event.title} | Cards Center`, description: event.description?.slice(0, 160) ?? undefined };
}

export default async function ShopEventDetailPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shopEvents");
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const isAdmin = session?.user?.accountType === "ADMIN";

  const event = await getShopEventDetail(id, viewerId);
  if (!event || (event.status === "DRAFT" && !isAdmin)) notFound();

  const [settings, viewerUser] = await Promise.all([
    getHubSettings(),
    viewerId ? prisma.user.findUnique({ where: { id: viewerId }, select: { dateOfBirth: true } }) : Promise.resolve(null),
  ]);
  const eligibility = viewerId ? await getBookingEligibility(viewerId) : null;
  const viewer = {
    loggedIn: !!viewerId,
    needsSupervision: !!viewerUser?.dateOfBirth && needsSupervision(viewerUser.dateOfBirth, new Date(event.startsAt)),
    eligibility: eligibility ? (eligibility.ok ? { ok: true } : { ok: false, reason: eligibility.error }) : { ok: false },
  };

  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const a = event.availability;

  const facts: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    { icon: <CalendarDays className="size-4" />, label: t("factDate"), value: formatEventDate(start, locale) },
    { icon: <Clock className="size-4" />, label: t("factTime"), value: `${formatEventTime(start, locale)} - ${formatEventTime(end, locale)}` },
    { icon: <MapPin className="size-4" />, label: t("factLocation"), value: `${PLATFORM.shop.name}, ${formatShopAddress()}` },
    {
      icon: <Users className="size-4" />,
      label: t("factSpots"),
      value: a.capacity === null ? t("spotsUnlimited") : a.full ? t("fullOf", { capacity: a.capacity }) : t("spotsLeftOf", { left: a.spotsLeft ?? 0, capacity: a.capacity }),
    },
  ];
  if (event.minAge !== null || event.maxAge !== null) {
    facts.push({
      icon: <Baby className="size-4" />,
      label: t("factAge"),
      value: event.minAge !== null && event.maxAge !== null ? t("ageRange", { min: event.minAge, max: event.maxAge }) : event.minAge !== null ? t("minAge", { age: event.minAge }) : t("maxAge", { age: event.maxAge ?? 0 }),
    });
  }

  return (
    <PageContainer width="default" className="py-6 sm:py-8">
      <Link href="/evenementen" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {t("backToList")}
      </Link>

      {event.status === "CANCELLED" && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          <strong>{t("cancelledBanner")}</strong>
          {event.cancelReason && <> {event.cancelReason}</>}
        </div>
      )}
      {event.status === "DRAFT" && isAdmin && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">{t("draftBanner")}</div>
      )}

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {event.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverImage} alt="" className="mb-5 aspect-[3/1] w-full rounded-2xl object-cover" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <EventTypePill name={event.typeName} color={event.typeColor} />
            {event.gameName && <span className="text-sm text-muted-foreground">{event.gameName}</span>}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{event.title}</h1>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
                <span className="mt-0.5 text-primary">{f.icon}</span>
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            {event.countsForLeague && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Trophy className="size-3.5" /> {t("countsForLeague")}
              </span>
            )}
            {event.countsForStampCard && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                <Stamp className="size-3.5" /> {t("countsForStampCard")}
              </span>
            )}
            {event.divisions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                {t("divisions")}: {event.divisions.map((d) => d.label).join(" · ")}
              </span>
            )}
            <a
              href={`/api/shop-events/${event.id}/ics`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              <CalendarPlus className="size-3.5" /> {t("addToCalendar")}
            </a>
          </div>

          {event.description && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-foreground">{t("aboutEvent")}</h2>
              <div className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground/85">{event.description}</div>
            </section>
          )}

          <section className="mt-8 rounded-2xl border border-border bg-muted/40 p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
              <Info className="size-4" /> {t("goodToKnow")}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-foreground/85">
              {event.registrationDeadline && (
                <li>
                  {t("deadlineLine", {
                    date: formatEventDateShort(new Date(event.registrationDeadline), locale),
                    time: formatEventTime(new Date(event.registrationDeadline), locale),
                  })}
                </li>
              )}
              {event.price > 0 && <li>{t("priceLine", { price: formatPrice(event.price, locale) })}</li>}
              {event.price > 0 && <li>{t("cancellationLine", { hours: event.cancellationHours })}</li>}
              {event.refundPolicy && <li>{event.refundPolicy}</li>}
              {event.underTwelveWithAdult ? <li>{t("underTwelveLine")}</li> : <li>{t("noUnderTwelveLine")}</li>}
              <li>{t("guardianLine")}</li>
              {settings.eventInfo && <li>{settings.eventInfo}</li>}
            </ul>
            {event.price > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">{settings.cancellationPolicy}</p>
            )}
          </section>

          {event.showParticipants && event.participantCount > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-foreground">{t("whoIsComing", { count: event.participantCount })}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("whoIsComingHint")}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {event.participants.map((p) => (
                  <li key={p.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm">
                    <UserAvatar src={p.avatarUrl} name={p.displayName} size="xs" />
                    <span className="font-medium text-foreground">{p.displayName}</span>
                    {p.divisionLabel && <span className="text-xs text-muted-foreground">{p.divisionLabel}</span>}
                  </li>
                ))}
                {event.participantCount > event.participants.length && (
                  <li className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                    +{event.participantCount - event.participants.length}
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <RegistrationPanel event={event} locale={locale} viewer={viewer} />
          {isAdmin && (
            <Link href={`/dashboard/admin/events/${event.id}`} className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground">
              {t("adminManage")}
            </Link>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}
