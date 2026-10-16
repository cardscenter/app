import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, CalendarRange, List } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { listShopEvents } from "@/lib/shop-events/queries";
import { listEnabledGames } from "@/lib/games-server";
import { prisma } from "@/lib/prisma";
import { ensureEventTypes } from "@/lib/shop-events/registrations";
import { getHubSettings } from "@/lib/app-config";
import { formatMonthHeading } from "@/lib/shop-events/format";
import { PLATFORM } from "@/lib/platform-config";
import { CenteredHero, CatalogGrid, PhaseLadder, BannerPromo, FaqSection, ClosingCta, CtaButton, DisplayHeading } from "@/components/ploy";
import type { CatalogFilter } from "@/components/ploy";
import { EventCatalogCard } from "@/components/shop-events/event-catalog-card";
import { ShopEventsCalendar } from "@/components/shop-events/shop-events-calendar";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shopEvents" });
  return { title: `${t("title")} | Cards Center`, description: t("metaDescription") };
}

type Search = { view?: string; game?: string; type?: string };

/**
 * Winkel-events (design-pass, Ploy-stijl): hero met veegstreep op "Hulst",
 * catalogus van punch-cards per maand (of de maandkalender), stappenladder
 * "zo werkt het", vragen en een slotpaneel. Filters op spel en type via
 * query-params (deelbare links).
 */
export default async function ShopEventsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("shopEvents");
  await ensureEventTypes();

  const [events, games, types, settings, session] = await Promise.all([
    listShopEvents({ game: sp.game || null, type: sp.type || null }),
    listEnabledGames(),
    prisma.eventType.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    getHubSettings(),
    auth(),
  ]);
  const loggedIn = !!session?.user?.id;
  const view = sp.view === "kalender" ? "calendar" : "list";

  const byMonth = new Map<string, typeof events>();
  for (const e of events) byMonth.set(e.monthKey, [...(byMonth.get(e.monthKey) ?? []), e]);

  const hrefWith = (patch: Partial<Search>) => {
    const q = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return `/evenementen${s ? `?${s}` : ""}`;
  };
  const filters: CatalogFilter[][] = [
    [{ label: t("filterAll"), href: hrefWith({ game: undefined, type: undefined }), active: !sp.game && !sp.type }],
    games.map((g) => ({ label: g.name, href: hrefWith({ game: sp.game === g.key ? undefined : g.key }), active: sp.game === g.key })),
    types.map((ty) => ({ label: ty.name, href: hrefWith({ type: sp.type === ty.key ? undefined : ty.key }), active: sp.type === ty.key })),
  ].filter((g) => g.length > 0);

  const toggle = (active: boolean) =>
    `inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold no-underline transition-colors ${active ? "bg-[var(--foreground)] text-white" : "text-[var(--foreground)]/65 hover:text-[var(--foreground)]"}`;
  const toolbar = (
    <div className="inline-flex rounded-full bg-white p-1">
      <Link href={hrefWith({ view: undefined })} className={toggle(view === "list")}>
        <List className="size-4" /> {t("viewList")}
      </Link>
      <Link href={hrefWith({ view: "kalender" })} className={toggle(view === "calendar")}>
        <CalendarRange className="size-4" /> {t("viewCalendar")}
      </Link>
    </div>
  );

  return (
    <div className="cc-landing overflow-clip pb-0">
      <CenteredHero title={t("heroTitle")} highlightWord={t("heroWord")} highlightColor="green" description={t("intro")} />

      <CatalogGrid filters={filters} toolbar={toolbar} grid={false} empty={<EmptyState title={t("emptyTitle")} body={t("emptyBody")} />}>
        {view === "calendar" ? (
          <ShopEventsCalendar events={events} locale={locale} />
        ) : events.length === 0 ? null : (
          <div className="space-y-12">
            {[...byMonth.entries()].map(([key, list]) => (
              <section key={key}>
                <DisplayHeading tag="h2" size={4} text={formatMonthHeading(new Date(list[0]!.startsAt), locale)} className="mb-5 text-[var(--foreground)]/35" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((e) => (
                    <EventCatalogCard key={e.id} event={e} locale={locale} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </CatalogGrid>

      <PhaseLadder
        color="blue"
        title={t("howTitle")}
        intro={t("howIntro")}
        steps={[
          { title: t("step1Title"), text: t("step1Text") },
          { title: t("step2Title"), text: t("step2Text") },
          { title: t("step3Title"), text: t("step3Text") },
          { title: t("step4Title"), text: t("step4Text") },
        ]}
      />

      <BannerPromo
        eyebrow={PLATFORM.shop.name}
        title={loggedIn ? t("bannerLoggedTitle") : t("bannerTitle")}
        text={loggedIn ? t("bannerLoggedText") : t("bannerText")}
        action={
          <CtaButton href={loggedIn ? "/dashboard/tickets" : "/register"} variant="light">
            {loggedIn ? t("bannerLoggedCta") : t("bannerCta")}
          </CtaButton>
        }
        note={loggedIn ? undefined : t("bannerNote")}
      />

      <FaqSection
        eyebrow={t("faqEyebrow")}
        title={t("faqTitle")}
        items={[
          { q: t("faq1Q"), a: t("faq1A") },
          { q: t("faq2Q"), a: settings.cancellationPolicy },
          { q: t("faq3Q"), a: t("faq3A") },
          { q: t("faq4Q"), a: t("faq4A") },
        ]}
      />

      <ClosingCta color="yellow" title={t("closingTitle")} text={t("closingText")}>
        <CtaButton href={loggedIn ? "/dashboard/tickets" : "/register"} variant="dark">
          {loggedIn ? t("bannerLoggedCta") : t("bannerCta")}
        </CtaButton>
        <CtaButton href="/info" variant="light">
          {t("closingSecondary")}
        </CtaButton>
      </ClosingCta>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[12px] bg-white p-10 text-center">
      <CalendarDays className="mx-auto size-8 text-[var(--foreground)]/40" />
      <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{title}</h2>
      <p className="cc-prose mx-auto mt-2 max-w-[28rem] text-sm">{body}</p>
    </div>
  );
}
