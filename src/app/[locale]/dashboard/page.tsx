import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { CalendarDays, Lock, ShieldCheck, Wallet } from "lucide-react";
import {
  fetchActionItems,
  fetchBalanceOverview,
  fetchActiveActivity,
  fetchCashFlow,
  fetchRecentOrders,
} from "@/lib/dashboard-queries";
import { hasValidShippingAddress } from "@/lib/address-validation";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { PeriodSelector } from "@/components/dashboard/statistics/period-selector";
import { BalanceHero } from "@/components/dashboard/home/balance-hero";
import { CashFlowCard } from "@/components/dashboard/home/cash-flow-card";
import { HomeKpiCard } from "@/components/dashboard/home/home-kpi-card";
import { RecentOrdersTable } from "@/components/dashboard/home/recent-orders-table";
import { ActionItemsWidget } from "@/components/dashboard/home/action-items-widget";
import { ActiveActivityWidget } from "@/components/dashboard/home/active-activity-widget";

// Dashboard-home in fintech-stijl (sept 2026): saldo-band → cash flow
// (aankopen vs verkopen) → KPI-rij → recente orders + actie-nodig/aanbod.
// Periode via ?period= (zelfde selector als /dashboard/statistieken), default 30d.

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

  const [actionItems, balance, activity, cashFlow, orders, hasShippingAddress] = await Promise.all([
    fetchActionItems(userId),
    fetchBalanceOverview(userId),
    fetchActiveActivity(userId),
    fetchCashFlow(userId, period),
    fetchRecentOrders(userId, 8),
    hasValidShippingAddress(userId),
  ]);

  const rangeLabel = `${formatDateShort(cashFlow.range.start)} – ${formatDateShort(cashFlow.range.end)}`;

  return (
    <div className="space-y-6">
      {/* Kop: titel + periode rechts (datumbereik-pill + dropdown) */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{th("greeting", { name: user.displayName })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-card">
            <CalendarDays className="size-4 text-muted-foreground" />
            {rangeLabel}
          </span>
          <PeriodSelector current={period} />
        </div>
      </header>

      <BalanceHero balance={balance} />

      <CashFlowCard data={cashFlow} showStatsLink={hasPremium} />

      <div className="grid gap-4 md:grid-cols-3">
        <HomeKpiCard
          icon={Wallet}
          iconClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          label={th("available")}
          hint={th("now")}
          value={formatCurrency(balance.available)}
          footnote={th("availableHint")}
          href="/dashboard/saldo"
        />
        <HomeKpiCard
          icon={ShieldCheck}
          iconClass="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          label={th("escrow")}
          hint={th("now")}
          value={formatCurrency(balance.escrow)}
          footnote={th("escrowHint")}
          href="/dashboard/verkopen"
        />
        <HomeKpiCard
          icon={Lock}
          iconClass="bg-sky-500/15 text-sky-600 dark:text-sky-400"
          label={th("reserved")}
          hint={th("now")}
          value={formatCurrency(balance.reserved)}
          footnote={th("reservedHint")}
          href="/dashboard/biedingen"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrdersTable rows={orders} />
        </div>
        <div className="space-y-6">
          <ActionItemsWidget
            counts={actionItems}
            totpEnabled={user.totpEnabled}
            hasShippingAddress={hasShippingAddress}
            layout="list"
          />
          <ActiveActivityWidget data={activity} />
        </div>
      </div>
    </div>
  );
}
