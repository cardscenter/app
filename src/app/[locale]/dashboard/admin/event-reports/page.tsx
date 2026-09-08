import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { AdminEventReportsList } from "@/components/dashboard/admin-event-reports-list";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";

export default async function AdminEventReportsPage() {
  await requireAdminPage();

  const reports = await prisma.eventReport.findMany({
    where: { status: { in: ["OPEN", "REVIEWING"] } },
    include: {
      reporter: { select: { displayName: true, email: true } },
      event: {
        select: { id: true, title: true, city: true, country: true, status: true, organizer: { select: { displayName: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = reports.map((r) => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    createdAt: r.createdAt.toISOString(),
    reporter: r.reporter,
    event: r.event,
  }));

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Gemelde evenementen"
        subtitle="Meldingen van bezoekers. Bij “Actie ondernemen” wordt het evenement verborgen (uit publicatie gehaald)."
      />
      <AdminEventReportsList reports={rows} />
    </div>
  );
}
