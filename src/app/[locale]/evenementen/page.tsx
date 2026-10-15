import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, List, CalendarRange } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { listShopEvents } from "@/lib/shop-events/queries";
import { listEnabledGames } from "@/lib/games-server";
import { prisma } from "@/lib/prisma";
import { ensureEventTypes } from "@/lib/shop-events/registrations";
import { formatMonthHeading } from "@/lib/shop-events/format";
import { ShopEventRow } from "@/components/shop-events/shop-event-row";
import { ShopEventsCalendar } from "@/components/shop-events/shop-events-calendar";
import { formatShopAddress, PLATFORM } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shopEvents" });
  return { title: `${t("title")} | Cards Center`, description: t("metaDescription") };
}

type Search = { view?: string; game?: string; type?: string };

/**
 * Winkel-events (Community Hub, Fase 3): alle gepubliceerde events in de
 * winkel in Hulst, als lijst per maand of als maandkalender. Filters op spel
 * en type via query-params (deelbare links).
 */
export default async function ShopEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("shopEvents");
  await ensureEventTypes();

  const [events, games, types] = await Promise.all([
    listShopEvents({ game: sp.game || null, type: sp.type || null }),
    listEnabledGames(),
    prisma.eventType.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
  ]);
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
  const chip = (active: boolean) =>
    `inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
    }`;

  return (
    <PageContainer width="default" className="py-8 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <CalendarDays className="size-3.5" />
            {PLATFORM.shop.name} · {formatShopAddress()}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("intro")}</p>
        </div>
        <div className="inline-flex shrink-0 rounded-full border border-border bg-card p-1">
          <Link href={hrefWith({ view: undefined })} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${view === "list" ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            <List className="size-4" /> {t("viewList")}
          </Link>
          <Link href={hrefWith({ view: "kalender" })} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${view === "calendar" ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            <CalendarRange className="size-4" /> {t("viewCalendar")}
          </Link>
        </div>
      </div>

      {(games.length > 1 || types.length > 1) && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={hrefWith({ game: undefined, type: undefined })} className={chip(!sp.game && !sp.type)}>
            {t("filterAll")}
          </Link>
          {games.map((g) => (
            <Link key={g.key} href={hrefWith({ game: sp.game === g.key ? undefined : g.key })} className={chip(sp.game === g.key)}>
              {g.name}
            </Link>
          ))}
          <span className="hidden w-px bg-border sm:block" />
          {types.map((ty) => (
            <Link key={ty.key} href={hrefWith({ type: sp.type === ty.key ? undefined : ty.key })} className={chip(sp.type === ty.key)}>
              {ty.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        {view === "calendar" ? (
          <ShopEventsCalendar events={events} locale={locale} />
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <CalendarDays className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">{t("emptyTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {[...byMonth.entries()].map(([key, list]) => (
              <section key={key}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatMonthHeading(new Date(list[0].startsAt), locale)}
                </h2>
                <div className="space-y-3">
                  {list.map((e) => (
                    <ShopEventRow key={e.id} event={e} locale={locale} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
