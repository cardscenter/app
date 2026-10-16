import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, Newspaper, Trophy, UtensilsCrossed, MapPin, Clock, ScrollText, Ticket, LayoutDashboard, Stamp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { listShopEvents } from "@/lib/shop-events/queries";
import { listPublishedNews } from "@/lib/community/news";
import { getActiveSeason, getStandings } from "@/lib/community/league";
import { getHubSettings } from "@/lib/app-config";
import { formatEventDate } from "@/lib/shop-events/format";
import { formatShopAddress, PLATFORM } from "@/lib/platform-config";
import { ShopEventRow } from "@/components/shop-events/shop-event-row";
import { StandingsTable } from "@/components/community/standings-table";
import { ZDivider } from "@/components/ui/z-divider";

const WRAP = "mx-auto w-full max-w-[1880px] px-[clamp(1rem,3vw,4rem)]";
const BTN = "inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover";
const BTN_GHOST = "inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15";

/**
 * Homepage van de Community Hub (Fase 5): zolang geen enkele handel-flag aan
 * staat is dít de startpagina. Events, nieuws, league en praktische info uit
 * de winkel in Hulst. De oude marketing-homepage blijft bestaan voor als de
 * handel terugkomt (zie `app/[locale]/page.tsx`).
 */
export async function HubHomepage({ locale, viewer }: { locale: string; viewer: { id: string; name: string } | null }) {
  const t = await getTranslations("home");
  const [events, news, season, settings] = await Promise.all([listShopEvents({}), listPublishedNews(3), getActiveSeason(), getHubSettings()]);
  const upcoming = events.filter((e) => e.status === "PUBLISHED").slice(0, 4);
  const standings = season ? (await getStandings(season.id, viewer?.id ?? null)).slice(0, 5) : [];
  const address = formatShopAddress();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0">
          <Image src="/images/hero-banner.png" alt="" fill sizes="100vw" priority className="object-cover object-[75%_center]" />
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(2,6,23,0.95) 0%, rgba(2,6,23,0.85) 35%, rgba(2,6,23,0.5) 65%, rgba(2,6,23,0.25) 100%)" }} />
        </div>
        <div className={`relative ${WRAP} py-16 lg:py-24`}>
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
              <MapPin className="size-3.5" /> {PLATFORM.shop.name} · {address}
            </p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              {viewer ? t("hubHeroTitleLoggedIn", { name: viewer.name }) : t("hubHeroTitle")}
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-200 sm:text-lg">{t("hubHeroSubtitle")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/evenementen" className={BTN}>
                <CalendarDays className="size-4" /> {t("hubCtaEvents")}
              </Link>
              {viewer ? (
                <>
                  <Link href="/dashboard/tickets" className={BTN_GHOST}>
                    <Ticket className="size-4" /> {t("hubCtaTickets")}
                  </Link>
                  <Link href="/dashboard" className={BTN_GHOST}>
                    <LayoutDashboard className="size-4" /> {t("hubCtaDashboard")}
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/register" className={BTN_GHOST}>
                    {t("hubCtaRegister")} <ArrowRight className="size-4" />
                  </Link>
                  <Link href="/league" className={BTN_GHOST}>
                    <Trophy className="size-4" /> {t("hubCtaLeague")}
                  </Link>
                </>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5"><Trophy className="size-4 text-amber-400" /> {t("hubPillLeague")}</span>
              <span className="inline-flex items-center gap-1.5"><Stamp className="size-4 text-amber-400" /> {t("hubPillStamps")}</span>
              <span className="inline-flex items-center gap-1.5"><UtensilsCrossed className="size-4 text-amber-400" /> {t("hubPillFood")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Events */}
      <section className="bg-card py-12 lg:py-16">
        <div className={WRAP}>
          <Header icon={<CalendarDays className="size-4" />} iconClass="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300" title={t("hubEventsTitle")} description={t("hubEventsDesc")} href="/evenementen" linkLabel={t("hubViewAll")} />
          {upcoming.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">{t("hubNoEvents")}</p>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {upcoming.map((e) => (
                <ShopEventRow key={e.id} event={e} locale={locale} />
              ))}
            </div>
          )}
        </div>
      </section>
      <ZDivider className="bg-card" fillClassName="text-background" />

      {/* Nieuws + league */}
      <section className="bg-background py-12 lg:py-16">
        <div className={`${WRAP} grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]`}>
          <div>
            <Header icon={<Newspaper className="size-4" />} iconClass="bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" title={t("hubNewsTitle")} description={t("hubNewsDesc")} href="/nieuws" linkLabel={t("hubViewAll")} />
            {news.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">{t("hubNoNews")}</p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {news.map((p) => (
                  <Link key={p.id} href={`/nieuws/${p.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover">
                    {p.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverImage} alt="" className="aspect-[16/9] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[16/9] items-center justify-center bg-muted text-muted-foreground"><Newspaper className="size-7" /></div>
                    )}
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground">{p.publishedAt ? formatEventDate(new Date(p.publishedAt), locale) : ""}</p>
                      <h3 className="mt-1 font-semibold leading-snug group-hover:underline">{p.title}</h3>
                      {p.excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div>
            <Header icon={<Trophy className="size-4" />} iconClass="bg-amber-50 text-amber-700 dark:bg-amber-900 dark:text-amber-300" title={season ? t("hubLeagueTitle", { name: season.name }) : t("hubLeagueTitleNoSeason")} description={t("hubLeagueDesc")} href="/league" linkLabel={t("hubViewAll")} />
            <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {standings.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">{season ? t("hubNoResults") : t("hubNoSeason")}</p>
              ) : (
                <StandingsTable rows={standings} compact />
              )}
            </div>
          </div>
        </div>
      </section>
      <ZDivider className="bg-background" fillClassName="text-card" />

      {/* Praktisch */}
      <section className="bg-card py-12 lg:py-16">
        <div className={`${WRAP} grid gap-6 md:grid-cols-3`}>
          <InfoTile icon={<Clock className="size-5" />} title={t("hubOpeningHours")} href="/info">
            <p className="whitespace-pre-line text-sm text-muted-foreground">{settings.openingHours}</p>
          </InfoTile>
          <InfoTile icon={<MapPin className="size-5" />} title={t("hubFindUs")} href="/info#bereikbaarheid">
            <p className="text-sm text-muted-foreground">
              {PLATFORM.shop.name}
              <br />
              {address}
            </p>
          </InfoTile>
          <InfoTile icon={<ScrollText className="size-5" />} title={t("hubHouseRules")} href="/info#huisregels">
            <p className="text-sm text-muted-foreground">{t("hubHouseRulesDesc")}</p>
          </InfoTile>
        </div>
      </section>
    </div>
  );
}

function Header({ icon, iconClass, title, description, href, linkLabel }: { icon: React.ReactNode; iconClass: string; title: string; description: string; href: string; linkLabel: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex size-7 items-center justify-center rounded-md ${iconClass}`}>{icon}</span>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {linkLabel} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function InfoTile({ icon, title, href, children }: { icon: React.ReactNode; title: string; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group rounded-2xl border border-border bg-background p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
        <h3 className="font-semibold group-hover:underline">{title}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </Link>
  );
}

