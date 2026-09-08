import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Building2, Phone, Calendar } from "lucide-react";
import { EnterpriseRequestActions } from "@/components/admin/enterprise-request-actions";
import { Link } from "@/i18n/navigation";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";

const STATUS_FILTERS = ["PENDING", "APPROVED", "REJECTED"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default async function AdminEnterpriseRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const filter: StatusFilter = STATUS_FILTERS.includes(params.status as StatusFilter)
    ? (params.status as StatusFilter)
    : "PENDING";

  const requests = await prisma.enterpriseRequest.findMany({
    where: { status: filter },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          accountType: true,
        },
      },
      reviewedBy: {
        select: { displayName: true },
      },
    },
  });

  const counts = await prisma.enterpriseRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.status, c._count._all]));

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Enterprise-aanvragen"
        subtitle="Handmatige goedkeuring voor Enterprise-tier (€749/m default, custom prijs mogelijk)."
        action={
          <nav className="inline-flex flex-wrap gap-1 dash-card p-1">
            {STATUS_FILTERS.map((s) => (
              <Link
                key={s}
                href={`/dashboard/admin/enterprise-requests?status=${s}`}
                className={
                  filter === s
                    ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              >
                {STATUS_LABEL[s]}{" "}
                <span className="ml-1 text-xs opacity-70">({countMap.get(s) ?? 0})</span>
              </Link>
            ))}
          </nav>
        }
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={`Geen aanvragen met status ${STATUS_LABEL[filter].toLowerCase()}.`}
          compact
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="dash-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{r.shopName}</h3>
                    <StatusBadge tone="primary">
                      €{r.estimatedMonthlyRevenue.toLocaleString("nl-NL")}/m
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Door <Link href={`/dashboard/admin/users/${r.user.id}`} className="text-primary hover:underline">{r.user.displayName}</Link>
                    {" "}<span className="text-xs">({r.user.email})</span> — huidige tier:{" "}
                    <span className="font-medium text-foreground">{r.user.accountType}</span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {r.phone}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {r.createdAt.toLocaleDateString("nl-NL")}
                    </span>
                  </div>

                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
                    {r.motivation}
                  </div>

                  {r.status === "REJECTED" && r.rejectionReason && (
                    <div className="mt-3 rounded-md border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
                      <strong>Afgewezen:</strong> {r.rejectionReason}
                      {r.reviewedBy && <span className="ml-1 text-xs">door {r.reviewedBy.displayName}</span>}
                    </div>
                  )}

                  {r.status === "APPROVED" && (
                    <div className="mt-3 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                      <strong>Goedgekeurd</strong> op €{r.approvedMonthlyPrice?.toLocaleString("nl-NL") ?? "?"}/m
                      {r.reviewedBy && <span className="ml-1 text-xs">door {r.reviewedBy.displayName}</span>}
                    </div>
                  )}
                </div>
              </div>

              {r.status === "PENDING" && (
                <div className="mt-4 border-t border-border pt-4">
                  <EnterpriseRequestActions requestId={r.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<StatusFilter, string> = {
  PENDING: "Openstaand",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
};
