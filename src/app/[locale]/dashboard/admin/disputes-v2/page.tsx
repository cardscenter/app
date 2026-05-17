import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Scale, Clock } from "lucide-react";

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
    <div>
      <h1 className="text-2xl font-bold text-foreground">Geschillen v2 — admin-queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Geëscaleerde geschillen die wachten op admin-beoordeling. SLA: 5 dagen na escalatie.
      </p>

      {escalated.length === 0 ? (
        <div className="mt-6 rounded-xl glass-subtle p-8 text-center">
          <Scale className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Geen geëscaleerde geschillen op dit moment.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {escalated.map((d) => {
            const remaining = d.bundle.totalCost - (d.bundle.refundedAmount ?? 0);
            const slaMs = d.adminSLADeadline ? d.adminSLADeadline.getTime() - now : 0;
            const slaDays = Math.ceil(slaMs / 86_400_000);
            const slaOverdue = slaMs < 0;
            const slaToneClass = slaOverdue
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
              : slaDays <= 2
              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";

            return (
              <Link
                key={d.id}
                href={`/dashboard/geschillen-v2/${d.id}`}
                className="block rounded-xl glass p-4 transition-colors hover:bg-muted/30"
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
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground tabular-nums">&euro;{remaining.toFixed(2)}</p>
                    <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${slaToneClass}`}>
                      <Clock className="h-3 w-3" />
                      {slaOverdue ? `SLA verstreken (${Math.abs(slaDays)}d)` : `SLA ${slaDays}d`}
                    </span>
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
