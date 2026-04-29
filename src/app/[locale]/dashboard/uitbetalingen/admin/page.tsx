import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminWithdrawalsList } from "@/components/dashboard/admin-withdrawals-list";

export default async function AdminWithdrawalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (me?.accountType !== "ADMIN") redirect("/dashboard");

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
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">{t("adminTitle")}</h1>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          {t("pendingTitle")} ({pending.length})
        </h2>
        <AdminWithdrawalsList rows={serialize(pending)} mode="pending" />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          {t("approvedTitle")} ({approved.length})
        </h2>
        <AdminWithdrawalsList rows={serialize(approved)} mode="approved" />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">{t("paidTitle")}</h2>
        <AdminWithdrawalsList rows={serialize(paid)} mode="paid" />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">{t("rejectedTitle")}</h2>
        <AdminWithdrawalsList rows={serialize(rejected)} mode="rejected" />
      </section>
    </div>
  );
}
