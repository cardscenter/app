import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Building2, Phone, Calendar } from "lucide-react";
import { EnterpriseRequestActions } from "@/components/admin/enterprise-request-actions";
import { Link } from "@/i18n/navigation";

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
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-500/10 p-3">
          <Building2 className="h-6 w-6 text-violet-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enterprise-aanvragen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Handmatige goedkeuring voor Enterprise-tier (€749/m default, custom prijs mogelijk).
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={`/dashboard/admin/enterprise-requests?status=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === s
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {STATUS_LABEL[s]}{" "}
            <span className="ml-1 text-xs opacity-70">({countMap.get(s) ?? 0})</span>
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Geen aanvragen met status {STATUS_LABEL[filter].toLowerCase()}.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{r.shopName}</h3>
                    <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                      €{r.estimatedMonthlyRevenue.toLocaleString("nl-NL")}/m
                    </span>
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

                  <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                    {r.motivation}
                  </div>

                  {r.status === "REJECTED" && r.rejectionReason && (
                    <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-400">
                      <strong>Afgewezen:</strong> {r.rejectionReason}
                      {r.reviewedBy && <span className="ml-1 text-xs">door {r.reviewedBy.displayName}</span>}
                    </div>
                  )}

                  {r.status === "APPROVED" && (
                    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
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
