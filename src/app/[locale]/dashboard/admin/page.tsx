import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminQueueCounts } from "@/lib/admin-queue-counts";
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
  Truck,
  Hourglass,
  Building2,
  CalendarDays,
} from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatCard } from "@/components/dashboard/ui/stat-card";
import { EmptyState } from "@/components/dashboard/ui/empty-state";

export default async function AdminOverviewPage() {
  const t = await getTranslations("admin");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [counts, totalEscrow, totalPendingPayouts, totalUserBalance, monthCommission, recentActivity] =
    await Promise.all([
      getAdminQueueCounts(),
      prisma.user.aggregate({ _sum: { heldBalance: true } }),
      prisma.withdrawalRequest.aggregate({
        where: { status: { in: ["PENDING", "APPROVED"] } },
        _sum: { amount: true },
      }),
      prisma.user.aggregate({ _sum: { balance: true } }),
      prisma.transaction.aggregate({
        where: { type: "COMMISSION", createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { admin: { select: { displayName: true } } },
      }),
    ]);

  // Tint van de icoon-tegel per queue (StatCard iconClassName).
  const tint = {
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    slate: "bg-muted text-muted-foreground",
  } as const;

  // Wachtrijen gegroepeerd zoals de sidebar: Geschillen & meldingen /
  // Financieel / Gebruikers & content.
  const queueGroups = [
    {
      key: "groupQueuesDisputes",
      tiles: [
        { href: "/dashboard/admin/disputes", label: t("kpiPendingDisputes"), value: counts.disputes, Icon: Scale, tint: tint.rose },
        { href: "/dashboard/admin/disputes?tab=active", label: t("kpiActiveDisputes"), value: counts.activeDisputes, Icon: Hourglass, tint: tint.amber },
        { href: "/dashboard/admin/shipping-issues", label: t("kpiShippingIssues"), value: counts.shippingIssues, Icon: Truck, tint: tint.blue },
        { href: "/dashboard/admin/reports", label: t("kpiPendingReports"), value: counts.reports, Icon: Flag, tint: tint.purple },
        { href: "/dashboard/admin/seller-warnings", label: t("kpiSellerWarnings"), value: counts.sellerWarnings, Icon: AlertTriangle, tint: tint.rose },
        { href: "/dashboard/admin/users?filter=bid-defaulters", label: t("kpiBidDefaulters"), value: counts.bidDefaulters, Icon: Ban, tint: tint.rose },
      ],
    },
    {
      key: "groupQueuesFinance",
      tiles: [
        { href: "/dashboard/admin/withdrawals", label: t("kpiPendingWithdrawals"), value: counts.withdrawals, Icon: Wallet, tint: tint.blue },
        { href: "/dashboard/admin/buybacks", label: t("kpiPendingBuybacks"), value: counts.buybacks, Icon: ArrowDownToLine, tint: tint.amber },
      ],
    },
    {
      key: "groupQueuesUsers",
      tiles: [
        { href: "/dashboard/admin/verifications", label: t("kpiPendingVerifications"), value: counts.verifications, Icon: ShieldCheck, tint: tint.emerald },
        { href: "/dashboard/admin/enterprise-requests", label: t("kpiEnterpriseRequests"), value: counts.enterpriseRequests, Icon: Building2, tint: tint.purple },
        { href: "/dashboard/admin/event-approvals", label: t("kpiEventApprovals"), value: counts.eventApprovals, Icon: CalendarDays, tint: tint.blue },
      ],
    },
  ] as const;

  const finTiles = [
    { labelKey: "kpiTotalEscrow", value: totalEscrow._sum.heldBalance ?? 0, Icon: Wallet },
    { labelKey: "kpiPendingPayouts", value: totalPendingPayouts._sum.amount ?? 0, Icon: Wallet },
    { labelKey: "kpiTotalUserBalance", value: totalUserBalance._sum.balance ?? 0, Icon: Coins },
    { labelKey: "kpiThisMonthCommission", value: Math.abs(monthCommission._sum.amount ?? 0), Icon: TrendingUp },
  ] as const;

  const quickActions = [
    { href: "/dashboard/admin/bank-transfers", labelKey: "quickConfirmBankTransfer", Icon: CreditCard, tint: tint.blue },
    { href: "/dashboard/admin/users", labelKey: "quickFindUser", Icon: Search, tint: tint.emerald },
    { href: "/dashboard/admin/users?filter=suspended", labelKey: "quickSuspendUser", Icon: Ban, tint: tint.rose },
  ] as const;

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("overviewTitle")} subtitle={t("overviewSubtitle")} />

      {queueGroups.map((group) => (
        <DashboardSection key={group.key} variant="plain" title={t(group.key)}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {group.tiles.map(({ href, label, value, Icon, tint: cls }) => (
              <StatCard key={href} href={href} label={label} value={value} icon={Icon} iconClassName={cls} />
            ))}
          </div>
        </DashboardSection>
      ))}

      <DashboardSection variant="plain" title={t("sectionFinance")}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {finTiles.map(({ labelKey, value, Icon }) => (
            <StatCard
              key={labelKey}
              label={t(labelKey)}
              value={`€${value.toFixed(2)}`}
              icon={Icon}
              iconClassName={tint.slate}
            />
          ))}
        </div>
      </DashboardSection>

      <DashboardSection variant="plain" title={t("quickActions")}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {quickActions.map(({ href, labelKey, Icon, tint: cls }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 dash-card p-4 transition-colors hover:bg-muted/40"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${cls}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-medium text-foreground">{t(labelKey)}</span>
            </Link>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title={t("recentActivity")}
        icon={<History className="size-4" />}
        contentClassName="p-0"
        action={
          <Link href="/dashboard/admin/audit" className="text-xs font-medium text-primary hover:underline">
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
                    <code className="text-[11px]">
                      {e.targetType}
                      {e.targetId ? `:${e.targetId.slice(0, 8)}…` : ""}
                    </code>
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
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
