import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminWithdrawalsList } from "@/components/dashboard/admin-withdrawals-list";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";

export default async function AdminWithdrawalsPage() {
  const t = await getTranslations("withdrawal");

  const [pending, approved, paid, rejected] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    }),
    prisma.withdrawalRequest.findMany({
      where: { status: "APPROVED" },
      orderBy: { approvedAt: "asc" },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    }),
    prisma.withdrawalRequest.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 25,
      include: { user: { select: { id: true, displayName: true, email: true } } },
    }),
    prisma.withdrawalRequest.findMany({
      where: { status: "REJECTED" },
      orderBy: { rejectedAt: "desc" },
      take: 25,
      include: { user: { select: { id: true, displayName: true, email: true } } },
    }),
  ]);

  function serialize(rows: typeof pending) {
    return rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      iban: r.iban,
      accountHolderName: r.accountHolderName,
      status: r.status,
      adminNote: r.adminNote,
      rejectReason: r.rejectReason,
      createdAt: r.createdAt.toISOString(),
      approvedAt: r.approvedAt?.toISOString() ?? null,
      paidAt: r.paidAt?.toISOString() ?? null,
      rejectedAt: r.rejectedAt?.toISOString() ?? null,
      user: { id: r.user.id, displayName: r.user.displayName, email: r.user.email },
    }));
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("adminTitle")} />

      <DashboardSection variant="plain" title={`${t("pendingTitle")} (${pending.length})`}>
        <AdminWithdrawalsList rows={serialize(pending)} mode="pending" />
      </DashboardSection>

      <DashboardSection variant="plain" title={`${t("approvedTitle")} (${approved.length})`}>
        <AdminWithdrawalsList rows={serialize(approved)} mode="approved" />
      </DashboardSection>

      <DashboardSection variant="plain" title={t("paidTitle")}>
        <AdminWithdrawalsList rows={serialize(paid)} mode="paid" />
      </DashboardSection>

      <DashboardSection variant="plain" title={t("rejectedTitle")}>
        <AdminWithdrawalsList rows={serialize(rejected)} mode="rejected" />
      </DashboardSection>
    </div>
  );
}
