import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminReportsList } from "@/components/dashboard/admin-reports-list";
import { isUserSuspended } from "@/lib/suspension";

export default async function AdminReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (me?.accountType !== "ADMIN") redirect("/dashboard");

  const t = await getTranslations("blockReport");

  const reports = await prisma.userReport.findMany({
    orderBy: [
      // OPEN first, then REVIEWING, then closed states by recency
      { status: "asc" },
      { createdAt: "desc" },
    ],
    include: {
      reporter: { select: { id: true, displayName: true } },
      reported: {
        select: {
          id: true,
          displayName: true,
          accountType: true,
          suspendedUntil: true,
          suspensionType: true,
        },
      },
      reviewedBy: { select: { displayName: true } },
    },
    take: 200,
  });

  // Group by reported user so admin can see patterns at a glance
  const byReported = new Map<string, typeof reports>();
  for (const r of reports) {
    const k = r.reportedId;
    const arr = byReported.get(k);
    if (arr) arr.push(r);
    else byReported.set(k, [r]);
  }

  const groups = Array.from(byReported.values()).map((reps) => ({
    reportedId: reps[0].reportedId,
    reportedName: reps[0].reported.displayName,
    reportedAccountType: reps[0].reported.accountType,
    reportedSuspended: isUserSuspended(reps[0].reported),
    openCount: reps.filter((r) => r.status === "OPEN" || r.status === "REVIEWING").length,
    reports: reps.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      evidenceUrl: r.evidenceUrl,
      status: r.status,
      adminNote: r.adminNote,
      reporterName: r.reporter.displayName,
      reviewerName: r.reviewedBy?.displayName ?? null,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
    })),
  }));

  // Sort: groups with open reports first, then most recent
  groups.sort((a, b) => {
    if (a.openCount !== b.openCount) return b.openCount - a.openCount;
    return 0;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("adminTitle")}</h1>
      <AdminReportsList groups={groups} />
    </div>
  );
}
