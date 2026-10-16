import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { CalendarDays, Lock, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import {
  fetchActionItems,
  fetchBalanceOverview,
  fetchActiveActivity,
  fetchCashFlow,
  fetchRecentOrders,
} from "@/lib/dashboard-queries";
import { hasValidShippingAddress } from "@/lib/address-validation";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { getFeatureSnapshot } from "@/lib/feature-flags";
import { maskActionItems, maskActiveActivity } from "@/lib/dashboard-feature-mask";
import { PeriodSelector } from "@/components/dashboard/statistics/period-selector";
import { BalanceHero } from "@/components/dashboard/home/balance-hero";
import { CashFlowCard } from "@/components/dashboard/home/cash-flow-card";
import { HomeKpiCard } from "@/components/dashboard/home/home-kpi-card";
import { RecentOrdersTable } from "@/components/dashboard/home/recent-orders-table";
import { ActionItemsWidget } from "@/components/dashboard/home/action-items-widget";
import { ActiveActivityWidget } from "@/components/dashboard/home/active-activity-widget";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";

// Dashboard-home in TailAdmin-stijl (sept 2026): saldo-band → KPI-rij →
// cash flow + actie-nodig → recente orders + lopend aanbod.
// Periode via ?period= (zelfde selector als /dashboard/statistieken), default 30d.
//
// Feature-flags (Community Hub, Fase 1): zonder FEATURE_WALLET vervallen de
// saldo-band, KPI-rij, cash flow en recente orders — er blijft een compacte
// kop met "Actie nodig" en lopende activiteit over. De echte hub-home
// (events, tickets, stempelkaart) komt in latere fases.

const DEFAULT_PERIOD = "30d";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params;
  const { period: rawPeriod } = await searchParams;
  const period = rawPeriod || DEFAULT_PERIOD;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const t = await getTranslations("dashboard");
  const th = await getTranslations("dashboard.home");

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, accountType: true, totpEnabled: true },
  });
  if (!user) return null;

  const hasPremium = user.accountType !== "FREE";
  const features = getFeatureSnapshot(user.accountType);
  const walletOn = features.FEATURE_WALLET;

  const [actionItemsRaw, activityRaw, hasShippingAddress] = await Promise.all([
    fetchActionItems(userId),
    fetchActiveActivity(userId),
    hasValidShippingAddress(userId),
  ]);
  const actionItems = maskActionItems(actionItemsRaw, features);
  const activity = maskActiveActivity(activityRaw, features);

  if (!walletOn) {
    return (
      <div className="space-y-4">
        <DashboardPageHeader title={t("title")} subtitle={th("greeting", { name: user.displayName })} />

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ActionItemsWidget
              counts={actionItems}
              totpEnabled={user.totpEnabled}
              hasShippingAddress={hasShippingAddress}
              layout="grid"
            />
          </div>
          <ActiveActivityWidget data={activity} />
        </div>
      </div>
    );
  }

  const [balance, cashFlow, orders] = await Promise.all([
    fetchBalanceOverview(userId),
    fetchCashFlow(userId, period),
    fetchRecentOrders(userId, 8),
  ]);

  const rangeLabel = `${formatDateShort(cashFlow.range.start)} – ${formatDateShort(cashFlow.range.end)}`;

  return (
    <div className="space-y-4">
      {/* Kop: titel + periode rechts (datumbereik-pill + dropdown) */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="cc-display text-[32px] text-foreground lg:text-[40px]">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{th("greeting", { name: user.displayName })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="cc-pill inline-flex items-center gap-2 bg-white px-4 py-2 text-sm font-semibold text-foreground">
            <CalendarDays className="size-4 text-muted-foreground" />
            {rangeLabel}
          </span>
          <PeriodSelector current={period} />
        </div>
      </header>

      <BalanceHero balance={balance} />

      {/* KPI-rij (TailAdmin): drie saldo-tegels + verkopen in de gekozen periode mét delta */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HomeKpiCard
          icon={Wallet}
          iconClass="text-emerald-600 dark:text-emerald-400"
          label={th("available")}
          hint={th("now")}
          value={formatCurrency(balance.available)}
          footnote={th("availableHint")}
          href="/dashboard/saldo"
        />
        <HomeKpiCard
          icon={ShieldCheck}
          iconClass="text-amber-600 dark:text-amber-400"
          label={th("escrow")}
          hint={th("now")}
          value={formatCurrency(balance.escrow)}
          footnote={th("escrowHint")}
          href="/dashboard/verkopen"
        />
        <HomeKpiCard
          icon={Lock}
          iconClass="text-sky-600 dark:text-sky-400"
          label={th("reserved")}
          hint={th("now")}
          value={formatCurrency(balance.reserved)}
          footnote={th("reservedHint")}
          href="/dashboard/biedingen"
        />
        <HomeKpiCard
          icon={TrendingUp}
          iconClass="text-primary"
          label={th("sales")}
          value={formatCurrency(cashFlow.current.sales)}
          comparison={cashFlow.comparison.sales}
          footnote={`${th("orders", { count: cashFlow.current.salesCount })} · ${rangeLabel}`}
          href="/dashboard/verkopen"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CashFlowCard data={cashFlow} showStatsLink={hasPremium} />
        </div>
        <ActionItemsWidget
          counts={actionItems}
          totpEnabled={user.totpEnabled}
          hasShippingAddress={hasShippingAddress}
          layout="list"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentOrdersTable rows={orders} />
        </div>
        <ActiveActivityWidget data={activity} />
      </div>
    </div>
  );
}
