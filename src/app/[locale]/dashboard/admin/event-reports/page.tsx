import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { AdminEventReportsList } from "@/components/dashboard/admin-event-reports-list";

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
    <div>
      <h1 className="text-2xl font-bold text-foreground">Gemelde evenementen</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Meldingen van bezoekers. Bij &ldquo;Actie ondernemen&rdquo; wordt het evenement
        verborgen (uit publicatie gehaald).
      </p>
      <div className="mt-6">
        <AdminEventReportsList reports={rows} />
      </div>
    </div>
  );
}
