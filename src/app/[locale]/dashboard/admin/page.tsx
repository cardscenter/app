import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import {
  Scale,
  ShieldCheck,
  Wallet,
  ArrowDownToLine,
  Flag,
  CreditCard,
  Search,
  Ban,
  History,
  Coins,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatCard } from "@/components/dashboard/ui/stat-card";
import { EmptyState } from "@/components/dashboard/ui/empty-state";

export default async function AdminOverviewPage() {
  const t = await getTranslations("admin");

  // KPI counts (queues)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    pendingDisputes,
    pendingVerifications,
    pendingWithdrawals,
    pendingBuybacks,
    openReports,
    sellerWarnings,
    bidDefaulters,
    totalEscrow,
    totalPendingPayouts,
    totalUserBalance,
    monthCommission,
    recentActivity,
  ] = await Promise.all([
    prisma.dispute.count({ where: { status: "ESCALATED" } }),
    prisma.verificationRequest.count({ where: { status: "PENDING" } }),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.buybackRequest.count({ where: { status: { in: ["PENDING", "RECEIVED", "INSPECTING"] } } }),
    prisma.userReport.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    // Seller-warnings: bundles auto-geannuleerd door cron (PAID >14d niet verzonden).
    // Alleen events van afgelopen 30 dagen tellen — historische incidenten zijn al
    // afgehandeld of staan in audit-log.
    prisma.shippingBundle.count({
      where: {
        autoExpiredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    // Fase 29: bid-defaulters die actief geschorst zijn vanwege wanbetaling.
    // 2+ strikes én een actieve suspend (suspendedUntil > now of PERMANENT).
    prisma.user.count({
      where: {
        paymentFailureCount: { gte: 2 },
        OR: [
          { suspensionType: "PERMANENT" },
          { suspendedUntil: { gt: new Date() } },
        ],
      },
    }),
    prisma.user.aggregate({ _sum: { heldBalance: true } }),
    prisma.withdrawalRequest.aggregate({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      _sum: { amount: true },
    }),
    prisma.user.aggregate({ _sum: { balance: true } }),
    prisma.transaction.aggregate({
      where: {
        type: "COMMISSION",
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { admin: { select: { displayName: true } } },
    }),
  ]);

  const queueTiles = [
    { href: "/dashboard/admin/disputes", labelKey: "kpiPendingDisputes", value: pendingDisputes, Icon: Scale, accent: "rose" as const },
    { href: "/dashboard/admin/verifications", labelKey: "kpiPendingVerifications", value: pendingVerifications, Icon: ShieldCheck, accent: "emerald" as const },
    { href: "/dashboard/admin/withdrawals", labelKey: "kpiPendingWithdrawals", value: pendingWithdrawals, Icon: Wallet, accent: "blue" as const },
    { href: "/dashboard/admin/buybacks", labelKey: "kpiPendingBuybacks", value: pendingBuybacks, Icon: ArrowDownToLine, accent: "amber" as const },
    { href: "/dashboard/admin/reports", labelKey: "kpiPendingReports", value: openReports, Icon: Flag, accent: "purple" as const },
    { href: "/dashboard/admin/seller-warnings", labelKey: "kpiSellerWarnings", value: sellerWarnings, Icon: AlertTriangle, accent: "rose" as const },
    { href: "/dashboard/admin/users?filter=bid-defaulters", labelKey: "kpiBidDefaulters", value: bidDefaulters, Icon: Ban, accent: "rose" as const },
  ] as const;

  const finTiles = [
    { labelKey: "kpiTotalEscrow", value: totalEscrow._sum.heldBalance ?? 0, Icon: Wallet },
    { labelKey: "kpiPendingPayouts", value: totalPendingPayouts._sum.amount ?? 0, Icon: Wallet },
    { labelKey: "kpiTotalUserBalance", value: totalUserBalance._sum.balance ?? 0, Icon: Coins },
    { labelKey: "kpiThisMonthCommission", value: Math.abs(monthCommission._sum.amount ?? 0), Icon: TrendingUp },
  ] as const;

  // Tint van de icoon-tegel per queue (StatCard iconClassName) — geen volvlak-kleur meer.
  const accentMap: Record<string, string> = {
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };

  const quickActions = [
    { href: "/dashboard/admin/bank-transfers", labelKey: "quickConfirmBankTransfer", Icon: CreditCard, tint: accentMap.blue },
    { href: "/dashboard/admin/users", labelKey: "quickFindUser", Icon: Search, tint: accentMap.emerald },
    { href: "/dashboard/admin/users?filter=suspended", labelKey: "quickSuspendUser", Icon: Ban, tint: accentMap.rose },
  ] as const;

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("overviewTitle")} subtitle={t("overviewSubtitle")} />

      {/* Queue KPI tiles */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {queueTiles.map(({ href, labelKey, value, Icon, accent }) => (
          <StatCard
            key={href}
            href={href}
            label={t(labelKey)}
            value={value}
            icon={Icon}
            iconClassName={accentMap[accent]}
          />
        ))}
      </section>

      {/* Financial tiles */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {finTiles.map(({ labelKey, value, Icon }) => (
          <StatCard
            key={labelKey}
            label={t(labelKey)}
            value={`€${value.toFixed(2)}`}
            icon={Icon}
            iconClassName="bg-muted text-muted-foreground"
          />
        ))}
      </section>

      {/* Quick-actions */}
      <DashboardSection variant="plain" title={t("quickActions")}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {quickActions.map(({ href, labelKey, Icon, tint }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 dash-card p-4 transition-colors hover:bg-muted/40"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tint}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-medium text-foreground">{t(labelKey)}</span>
            </Link>
          ))}
        </div>
      </DashboardSection>

      {/* Recent activity */}
      <DashboardSection
        title={t("recentActivity")}
        icon={<History className="size-4" />}
        contentClassName="p-0"
        action={
          <Link
            href="/dashboard/admin/audit"
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("navAudit")}
          </Link>
        }
      >
        {recentActivity.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={History} title={t("noRecentActivity")} compact />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recentActivity.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">{e.admin?.displayName ?? "Systeem"}</span>{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{e.action}</code>{" "}
                    <span className="text-muted-foreground">on</span>{" "}
                    <code className="text-[11px]">{e.targetType}{e.targetId ? `:${e.targetId.slice(0, 8)}…` : ""}</code>
                  </p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {e.createdAt.toLocaleString("nl-NL")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>
    </div>
  );
}
