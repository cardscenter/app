import { getTranslations } from "next-intl/server";
import { ArrowRight, Bell, MessageSquare, PackageOpen, ShieldCheck, Sparkles, Stamp, Ticket, Trophy, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { HubDashboardData } from "@/lib/dashboard-hub-data";
import { formatEventDateShort, formatEventTime } from "@/lib/shop-events/format";
import { formatEuro } from "@/lib/food/pricing";
import { CtaButton } from "@/components/ploy/cta-button";
import { FloatingBalloon } from "@/components/ploy/balloon";
import { StampCardVisual } from "@/components/community/stamp-card-visual";
import { DashTile } from "@/components/dashboard/ui/dash-tile";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import { Callout } from "@/components/dashboard/ui/callout";
import { TONE_ICON } from "@/components/dashboard/ui/tones";
import { PILL_BTN_SM } from "@/components/ploy/tile-styles";

const FOOD_TONE: Record<string, StatusTone> = {
  AWAITING_PAYMENT: "warning",
  NEW: "info",
  PREPARING: "info",
  READY: "success",
  DONE: "neutral",
  PAYMENT_FAILED: "danger",
};
const BUYBACK_KEY: Record<string, string> = {
  PENDING: "statusPending",
  RECEIVED: "statusReceived",
  INSPECTING: "statusInspecting",
  APPROVED: "statusApproved",
  PARTIALLY_APPROVED: "statusPartiallyApproved",
  RETURN_REQUESTED: "statusReturnRequested",
};

/**
 * Dashboard-home voor de Community Hub (design-pass ronde G, 2026-10-17):
 * pastel welkomstpaneel, vier tegels (ticket, stempelkaart, league,
 * spaarpunten) en daaronder alleen de blokken die iets te melden hebben.
 */
export async function HubHome({
  locale,
  firstName,
  data,
  unread,
  totpEnabled,
}: {
  locale: string;
  firstName: string;
  data: HubDashboardData;
  unread: { messages: number; notifications: number };
  totpEnabled: boolean;
}) {
  const [t, tf, tb] = await Promise.all([getTranslations("dashboard.hub"), getTranslations("food"), getTranslations("buyback")]);
  const lang = locale === "en" ? "en" : "nl";
  const when = (iso: string) => `${formatEventDateShort(new Date(iso), lang)} · ${formatEventTime(new Date(iso), lang)}`;
  const foodStatus = (s: string) =>
    ({ NEW: tf("st1"), PREPARING: tf("st2"), READY: tf("st3B"), DONE: tf("stDoneB"), AWAITING_PAYMENT: tf("stPay"), PAYMENT_FAILED: tf("payFailedTitle") })[s] ?? s;

  const ticket = data.nextTicket;
  const ticketHint = ticket
    ? ticket.status === "WAITLIST"
      ? t("ticketWaitlist")
      : ticket.status === "OFFERED"
        ? t("ticketOffered")
        : data.ticketCount > 1
          ? `${when(ticket.startsAt)} · ${t("ticketMore", { count: data.ticketCount })}`
          : when(ticket.startsAt)
    : data.nextEvent
      ? t("noTicketNextEvent", { title: data.nextEvent.title })
      : t("noTicketNoEvent");

  const league = data.league;
  const stampsLeft = Math.max(0, data.stamps.perCard - data.stamps.onCard);
  const inboxTotal = unread.messages + unread.notifications;

  return (
    <div className="space-y-6">
      {/* Welkom: pastel paneel met display-kop en twee knoppen */}
      <section className="relative overflow-hidden rounded-[20px] bg-[var(--pastel-yellow)] px-6 py-8 sm:px-10 sm:py-10">
        <FloatingBalloon color="red" shape="cloud" className="pointer-events-none absolute -right-14 -top-14 size-32 opacity-90 sm:right-8 sm:top-1/2 sm:size-56 sm:-translate-y-1/2" />
        <FloatingBalloon color="pink" shape="flower" duration={18} className="pointer-events-none absolute -bottom-12 right-40 hidden size-32 md:block" />
        <div className="relative max-w-xl">
          <h1 className="cc-display text-[44px] leading-[0.9] text-[var(--pastel-yellow-ink)] sm:text-[64px]">{t("hello", { name: firstName })}</h1>
          <p className="relative mt-3 max-w-md text-[15px] text-[var(--pastel-yellow-ink)]/80">{t("intro")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <CtaButton href="/evenementen" variant="red" icon={<ArrowRight className="size-4" />}>
              {t("ctaEvents")}
            </CtaButton>
            <CtaButton href="/bestellen?modus=bar" variant="dark">
              {t("ctaOrder")}
            </CtaButton>
          </div>
        </div>
      </section>

      {/* Vier tegels */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashTile
          href={ticket ? `/dashboard/tickets/${ticket.code}` : data.nextEvent ? `/evenementen/${data.nextEvent.id}` : "/evenementen"}
          icon={Ticket}
          tone="pink"
          label={t("nextTicket")}
          title={ticket ? ticket.title : t("noTicket")}
          hint={ticketHint}
        />
        <DashTile
          href="/dashboard/league"
          icon={Stamp}
          tone="yellow"
          label={t("stampCard")}
          title={t("stampsOnCard", { n: data.stamps.onCard, per: data.stamps.perCard })}
          display
          hint={data.stamps.reward ? t("stampsLeft", { left: stampsLeft, reward: data.stamps.reward }) : undefined}
        >
          <StampCardVisual total={data.stamps.perCard} filled={data.stamps.onCard} className="mt-auto max-w-[220px] gap-1.5" />
        </DashTile>
        <DashTile
          href="/dashboard/league"
          icon={Trophy}
          tone="blue"
          label={league ? `${t("league")} · ${league.seasonName}` : t("league")}
          title={league ? (league.rank ? t("leagueRank", { rank: league.rank }) : t("leagueNoRank")) : t("leagueNoSeason")}
          display={!!league?.rank}
          hint={
            league
              ? league.rank
                ? t("leagueRankHint", { points: league.points, season: league.seasonName })
                : t("leagueNoRankHint", { season: league.seasonName })
              : t("leagueNoSeasonHint")
          }
        />
        <DashTile href="/dashboard/league" icon={Sparkles} tone="green" label={t("points")} title={data.points} display hint={t("pointsHint")} />
      </div>

      {!totpEnabled && (
        <Callout
          tone="blue"
          icon={ShieldCheck}
          title={t("twoFaTitle")}
          action={
            <Link href="/dashboard/profiel" className={PILL_BTN_SM}>
              {t("twoFaAction")}
            </Link>
          }
        >
          {t("twoFaText")}
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Berichten en meldingen: altijd zichtbaar */}
        <DashboardSection title={t("inbox")}>
          <div className="space-y-2">
            {[
              { href: "/berichten", icon: MessageSquare, label: t("messages"), n: unread.messages, tone: "blue" as const },
              { href: "/dashboard/meldingen", icon: Bell, label: t("notifications"), n: unread.notifications, tone: "pink" as const },
            ].map((row) => (
              <Link key={row.href} href={row.href} className="flex items-center gap-3 rounded-[12px] px-2 py-2 no-underline transition-colors hover:bg-background">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${TONE_ICON[row.tone]}`}>
                  <row.icon className="size-4" />
                </span>
                <span className="flex-1 text-sm font-medium text-foreground">{row.label}</span>
                <span className={`cc-pill min-w-7 px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${row.n > 0 ? "cc-grad text-white" : "bg-background text-foreground/50"}`}>{row.n}</span>
              </Link>
            ))}
            {inboxTotal === 0 && <p className="px-2 pt-1 text-xs text-muted-foreground">{t("allClear")}</p>}
          </div>
        </DashboardSection>

        {data.recentOrders.length > 0 && (
          <DashboardSection
            title={t("ordersTitle")}
            action={
              <Link href="/dashboard/bestellingen" className="text-sm font-semibold text-primary no-underline hover:underline">
                {t("ordersAll")}
              </Link>
            }
          >
            <ul className="space-y-2">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 rounded-[12px] px-2 py-2">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${TONE_ICON.yellow}`}>
                    <UtensilsCrossed className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{t("orderN", { n: o.number })}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatEventDateShort(new Date(o.createdAt), lang)} · {formatEuro(o.total, lang)}
                    </p>
                  </div>
                  <StatusBadge tone={FOOD_TONE[o.status] ?? "neutral"}>{foodStatus(o.status)}</StatusBadge>
                </li>
              ))}
            </ul>
          </DashboardSection>
        )}

        {data.openBuyback && (
          <DashboardSection title={t("buybackTitle")} tone="green">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/70">
                <PackageOpen className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {data.openBuyback.type === "BULK" ? t("buybackBulk") : t("buybackSingles")} · {tb(BUYBACK_KEY[data.openBuyback.status] ?? "statusPending")}
                </p>
                <p className="mt-0.5 text-sm opacity-80">{t("buybackHint", { amount: formatEuro(data.openBuyback.estimatedPayout, lang) })}</p>
              </div>
            </div>
            <Link href={`/dashboard/inkoop/${data.openBuyback.id}`} className={`${PILL_BTN_SM} mt-4`}>
              {t("buybackOpen")}
              <ArrowRight className="size-3.5" />
            </Link>
          </DashboardSection>
        )}
      </div>
    </div>
  );
}
