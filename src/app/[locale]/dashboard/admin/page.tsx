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
  ] as const;

  const finTiles = [
    { labelKey: "kpiTotalEscrow", value: totalEscrow._sum.heldBalance ?? 0, Icon: Wallet },
    { labelKey: "kpiPendingPayouts", value: totalPendingPayouts._sum.amount ?? 0, Icon: Wallet },
    { labelKey: "kpiTotalUserBalance", value: totalUserBalance._sum.balance ?? 0, Icon: Coins },
    { labelKey: "kpiThisMonthCommission", value: Math.abs(monthCommission._sum.amount ?? 0), Icon: TrendingUp },
  ] as const;

  const accentMap: Record<string, string> = {
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
    purple: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-300",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("overviewTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("overviewSubtitle")}</p>
      </div>

      {/* Queue KPI tiles */}
      <section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {queueTiles.map(({ href, labelKey, value, Icon, accent }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col gap-2 rounded-xl border p-4 transition-all hover:scale-[1.02] ${accentMap[accent]}`}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5" />
                <span className="text-3xl font-bold tabular-nums">{value}</span>
              </div>
              <p className="text-sm font-medium leading-tight">{t(labelKey)}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Financial tiles */}
      <section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {finTiles.map(({ labelKey, value, Icon }) => (
            <div
              key={labelKey}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold tabular-nums">€{value.toFixed(2)}</span>
              </div>
              <p className="text-sm font-medium text-muted-foreground">{t(labelKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick-actions */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
          {t("quickActions")}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Link
            href="/dashboard/admin/bank-transfers"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:bg-muted"
          >
            <CreditCard className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">{t("quickConfirmBankTransfer")}</span>
          </Link>
          <Link
            href="/dashboard/admin/users"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:bg-muted"
          >
            <Search className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium">{t("quickFindUser")}</span>
          </Link>
          <Link
            href="/dashboard/admin/users?filter=suspended"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:bg-muted"
          >
            <Ban className="h-5 w-5 text-rose-600" />
            <span className="text-sm font-medium">{t("quickSuspendUser")}</span>
          </Link>
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t("recentActivity")}
          </h2>
          <Link
            href="/dashboard/admin/audit"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <History className="h-3.5 w-3.5" />
            {t("navAudit")}
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border bg-muted p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("noRecentActivity")}</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {recentActivity.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">{e.admin.displayName}</span>{" "}
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
      </section>
    </div>
  );
}
