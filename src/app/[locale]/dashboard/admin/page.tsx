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
import { TONE_ICON, type DashTone } from "@/components/dashboard/ui/tones";

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

  // Pastel-toon van de icoon-cirkel per queue (zie dashboard/ui/tones.ts).
  const tint = {
    rose: "pink",
    emerald: "green",
    blue: "blue",
    amber: "yellow",
    purple: "pink",
    slate: "neutral",
  } as const satisfies Record<string, DashTone>;

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
              <StatCard key={href} href={href} label={label} value={value} icon={Icon} tone={cls} />
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
              tone={tint.slate}
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
              className="flex items-center gap-3 dash-card p-4 no-underline transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${TONE_ICON[cls]}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-semibold text-foreground">{t(labelKey)}</span>
            </Link>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title={t("recentActivity")}
        icon={<History className="size-4" />}
        contentClassName="p-0"
        action={
          <Link href="/dashboard/admin/audit" className="text-sm font-semibold text-primary hover:underline">
            {t("navAudit")}
          </Link>
        }
      >
        {recentActivity.length === 0 ? (
          <div className="px-5 pb-5 sm:px-6">
            <EmptyState icon={History} title={t("noRecentActivity")} compact />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recentActivity.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">{e.admin?.displayName ?? "Systeem"}</span>{" "}
                    <code className="rounded-full bg-[var(--pastel-blue-light)] px-2 py-0.5 text-[10px] text-[var(--pastel-blue-ink)]">{e.action}</code>{" "}
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
