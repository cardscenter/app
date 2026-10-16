import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarPlus, ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getShopEventDetail } from "@/lib/shop-events/queries";
import { getBookingEligibility } from "@/lib/event-eligibility";
import { needsSupervision } from "@/lib/age";
import { getHubSettings } from "@/lib/app-config";
import { formatEventDate, formatEventTime, formatPrice, formatEventDateShort } from "@/lib/shop-events/format";
import { formatShopAddress, PLATFORM } from "@/lib/platform-config";
import { CenteredHero, DataCard, Pill, PhaseLadder, FeatureRows, BannerPromo, CtaButton, Panel } from "@/components/ploy";
import type { DataTile, FeatureRow } from "@/components/ploy";
import { EventTypePill, typePastel } from "@/components/shop-events/event-type-pill";
import { RegistrationPanel } from "@/components/shop-events/registration-panel";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.shopEvent.findUnique({ where: { id }, select: { title: true, description: true, status: true } });
  if (!event || event.status === "DRAFT") return { title: "Cards Center" };
  return { title: `${event.title} | Cards Center`, description: event.description?.slice(0, 160) ?? undefined };
}

/**
 * Event-detail (design-pass, Ploy-stijl): gecentreerde hero met type-pil,
 * datakaart met de feiten naast het inschrijfpaneel, stappenladder, "goed om
 * te weten"-rijen, deelnemers en een promo-strook. Flows ongewijzigd.
 */
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
  const pastel = typePastel(event.typeColor);

  const tiles: DataTile[] = [
    { label: t("factDate"), value: formatEventDate(start, locale) },
    { label: t("factTime"), value: `${formatEventTime(start, locale)} - ${formatEventTime(end, locale)}` },
    { label: t("factLocation"), value: PLATFORM.shop.name, hint: formatShopAddress() },
    {
      label: t("factSpots"),
      value: a.capacity === null ? t("spotsUnlimited") : a.full ? t("fullOf", { capacity: a.capacity }) : t("spotsLeftOf", { left: a.spotsLeft ?? 0, capacity: a.capacity }),
    },
    { label: t("factPrice"), value: formatPrice(event.price, locale) },
  ];
  if (event.minAge !== null || event.maxAge !== null) {
    tiles.push({
      label: t("factAge"),
      value: event.minAge !== null && event.maxAge !== null ? t("ageRange", { min: event.minAge, max: event.maxAge }) : event.minAge !== null ? t("minAge", { age: event.minAge }) : t("maxAge", { age: event.maxAge ?? 0 }),
    });
  }

  const rows: FeatureRow[] = [];
  if (event.registrationDeadline) rows.push({ title: t("rowDeadline"), text: t("deadlineLine", { date: formatEventDateShort(new Date(event.registrationDeadline), locale), time: formatEventTime(new Date(event.registrationDeadline), locale) }) });
  if (event.price > 0) rows.push({ title: t("rowPayment"), text: `${t("priceLine", { price: formatPrice(event.price, locale) })} ${t("cancellationLine", { hours: event.cancellationHours })}${event.refundPolicy ? ` ${event.refundPolicy}` : ""}` });
  rows.push({ title: t("rowAge"), text: `${event.underTwelveWithAdult ? t("underTwelveLine") : t("noUnderTwelveLine")} ${t("guardianLine")}` });
  if (settings.eventInfo) rows.push({ title: t("rowShop"), text: settings.eventInfo });
  if (event.price > 0 && settings.cancellationPolicy) rows.push({ title: t("rowCancellation"), text: settings.cancellationPolicy });

  return (
    <div className="cc-landing overflow-clip">
      <div className="mx-auto w-full max-w-6xl px-4 pt-2 sm:px-5 lg:px-6">
        <Link href="/evenementen" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]/60 no-underline hover:text-[var(--foreground)]">
          <ChevronLeft className="size-4" /> {t("backToList")}
        </Link>
      </div>

      {event.status === "CANCELLED" && (
        <Notice tone="pink">
          <strong>{t("cancelledBanner")}</strong>
          {event.cancelReason && <> {event.cancelReason}</>}
        </Notice>
      )}
      {event.status === "DRAFT" && isAdmin && <Notice tone="yellow">{t("draftBanner")}</Notice>}

      <CenteredHero
        eyebrow={`${event.typeName}${event.gameName ? ` · ${event.gameName}` : ""}`}
        eyebrowColor={pastel}
        title={event.title}
        size={2}
        description={`${formatEventDate(start, locale)} · ${formatEventTime(start, locale)} ${locale === "en" ? "to" : "tot"} ${formatEventTime(end, locale)}`}
        className="pb-8 lg:pb-10"
      >
        <a href={`/api/shop-events/${event.id}/ics`} className="cc-pill inline-flex h-11 items-center gap-2 bg-white px-5 text-sm font-semibold text-[var(--foreground)] no-underline shadow-[0_8px_30px_-12px_rgba(32,32,32,0.25)] hover:bg-[var(--muted)]">
          <CalendarPlus className="size-4" /> {t("addToCalendar")}
        </a>
      </CenteredHero>

      {event.coverImage && (
        <div className="px-0 pb-6 sm:px-5 lg:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.coverImage} alt="" className="aspect-[3/1] w-full rounded-[var(--radius-panel)] object-cover" />
        </div>
      )}

      {/* Feiten + inschrijven */}
      <section className="flex justify-center px-4 pb-6 sm:px-5 lg:px-6">
        <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-6">
            <DataCard badge={t("factsBadge")} badgeColor={pastel} tiles={tiles} columns={2}>
              <div className="flex flex-wrap gap-2">
                <EventTypePill name={event.typeName} color={event.typeColor} />
                {event.countsForLeague && (
                  <Pill tone="pastel" color="green">
                    {t("countsForLeague")}
                  </Pill>
                )}
                {event.countsForStampCard && (
                  <Pill tone="pastel" color="yellow">
                    {t("countsForStampCard")}
                  </Pill>
                )}
                {event.divisions.length > 0 && (
                  <Pill tone="white" className="border border-[var(--border)]">
                    {t("divisions")}: {event.divisions.map((d) => d.label).join(" · ")}
                  </Pill>
                )}
              </div>
            </DataCard>
            {event.description && (
              <div className="rounded-[12px] bg-white p-6 sm:p-8">
                <Pill color="blue">{t("aboutEvent")}</Pill>
                <div className="cc-prose mt-5 max-w-[42rem] whitespace-pre-line text-base leading-relaxed">{event.description}</div>
              </div>
            )}
          </div>
          <aside className="lg:sticky lg:top-[calc(var(--site-nav-offset)+1rem)] lg:self-start">
            <RegistrationPanel event={event} locale={locale} viewer={viewer} />
            {isAdmin && (
              <Link href={`/dashboard/admin/events/${event.id}`} className="mt-3 block text-center text-xs font-semibold text-[var(--foreground)]/50 no-underline hover:text-[var(--foreground)]">
                {t("adminManage")}
              </Link>
            )}
          </aside>
        </div>
      </section>

      <PhaseLadder
        color={pastel}
        title={t("howTitle")}
        intro={t("howIntro")}
        steps={[
          { title: t("step1Title"), text: t("step1Text") },
          { title: t("step2Title"), text: t("step2Text") },
          { title: t("step3Title"), text: t("step3Text") },
          { title: t("step4Title"), text: t("step4Text") },
        ]}
      />

      <FeatureRows title={t("goodToKnow")} rows={rows} />

      {event.showParticipants && event.participantCount > 0 && (
        <Panel color="white" padding="sm">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">{t("whoIsComing", { count: event.participantCount })}</h2>
          <p className="mt-1 text-xs text-[var(--foreground)]/55">{t("whoIsComingHint")}</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {event.participants.map((p) => (
              <li key={p.id} className="cc-pill inline-flex items-center gap-2 bg-[var(--background)] py-1 pl-1 pr-3 text-sm">
                <UserAvatar src={p.avatarUrl} name={p.displayName} size="xs" />
                <span className="font-semibold text-[var(--foreground)]">{p.displayName}</span>
                {p.divisionLabel && <span className="text-xs text-[var(--foreground)]/55">{p.divisionLabel}</span>}
              </li>
            ))}
            {event.participantCount > event.participants.length && <li className="cc-pill inline-flex items-center bg-[var(--background)] px-3 py-1 text-sm text-[var(--foreground)]/60">+{event.participantCount - event.participants.length}</li>}
          </ul>
        </Panel>
      )}

      <BannerPromo
        eyebrow={PLATFORM.shop.name}
        title={viewer.loggedIn ? t("bannerLoggedTitle") : t("bannerTitle")}
        text={viewer.loggedIn ? t("bannerLoggedText") : t("bannerText")}
        action={
          <CtaButton href={viewer.loggedIn ? "/dashboard/tickets" : "/register"} variant="light">
            {viewer.loggedIn ? t("bannerLoggedCta") : t("bannerCta")}
          </CtaButton>
        }
        note={viewer.loggedIn ? undefined : t("bannerNote")}
      />
    </div>
  );
}

function Notice({ tone, children }: { tone: "pink" | "yellow"; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-5 lg:px-6">
      <div className="rounded-[12px] px-5 py-4 text-sm text-[var(--foreground)]" style={{ background: tone === "pink" ? "var(--pastel-pink)" : "var(--pastel-yellow)" }}>
        {children}
      </div>
    </div>
  );
}
