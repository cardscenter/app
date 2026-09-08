import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Scale, Clock } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";

export default async function AdminDisputesV2Page() {
  // requireAdminPage zit in de admin-layout, dus deze pagina is alleen voor admins
  const escalated = await prisma.disputeV2.findMany({
    where: { status: "ESCALATED" },
    orderBy: { adminSLADeadline: "asc" },
    include: {
      buyer: { select: { id: true, displayName: true } },
      seller: { select: { id: true, displayName: true } },
      bundle: { select: { id: true, orderNumber: true, totalCost: true, refundedAmount: true } },
    },
  });

  const now = Date.now();

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Geschillen v2 — admin-queue"
        subtitle="Geëscaleerde geschillen die wachten op admin-beoordeling. SLA: 5 dagen na escalatie."
      />

      {escalated.length === 0 ? (
        <EmptyState icon={Scale} title="Geen geëscaleerde geschillen op dit moment." compact />
      ) : (
        <div className="space-y-3">
          {escalated.map((d) => {
            const remaining = d.bundle.totalCost - (d.bundle.refundedAmount ?? 0);
            const slaMs = d.adminSLADeadline ? d.adminSLADeadline.getTime() - now : 0;
            const slaDays = Math.ceil(slaMs / 86_400_000);
            const slaOverdue = slaMs < 0;
            const slaTone: StatusTone = slaOverdue ? "danger" : slaDays <= 2 ? "warning" : "info";

            return (
              <Link
                key={d.id}
                href={`/dashboard/geschillen-v2/${d.id}`}
                className="block dash-card p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{d.id.slice(0, 8)}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                        {d.bundle.orderNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {d.reasonCategory.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {d.buyer.displayName} <span className="text-muted-foreground">vs</span> {d.seller.displayName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{d.buyerStatement}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <p className="text-sm font-semibold text-foreground tabular-nums">&euro;{remaining.toFixed(2)}</p>
                    <StatusBadge tone={slaTone} icon={Clock}>
                      {slaOverdue ? `SLA verstreken (${Math.abs(slaDays)}d)` : `SLA ${slaDays}d`}
                    </StatusBadge>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
