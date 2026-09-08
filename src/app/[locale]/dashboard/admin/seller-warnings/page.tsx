import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, ExternalLink, Ban } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";

// Lijst van bundles die automatisch zijn geannuleerd door de
// `auto-cancel-stale-paid` cron — sellers die 14 dagen niet verzonden hebben.
// Geaccentueerd: bundles waar de seller eerder een cancel-verzoek afwees zijn
// extra verdacht (gebruiker had het hard gemaakt om te annuleren én leverde
// vervolgens niet). Admin gebruikt deze view om te besluiten of een seller
// een suspension verdient.
export default async function SellerWarningsPage() {
  await requireAdminPage();

  const bundles = await prisma.shippingBundle.findMany({
    where: { autoExpiredAt: { not: null } },
    orderBy: { autoExpiredAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      totalCost: true,
      autoExpiredAt: true,
      createdAt: true,
      seller: { select: { id: true, displayName: true, email: true, suspendedUntil: true, suspensionType: true } },
      buyer: { select: { id: true, displayName: true } },
      cancellationRequests: {
        where: { status: "REJECTED" },
        orderBy: { respondedAt: "desc" },
        take: 1,
        select: {
          reason: true,
          respondedAt: true,
          rejectionNote: true,
          proposedById: true,
        },
      },
    },
  });

  // Aggregeer per seller voor de top-offenders-tabel
  const sellerStats = new Map<string, { displayName: string; email: string; count: number; totalRefunded: number; suspended: boolean; sellerId: string }>();
  for (const b of bundles) {
    const existing = sellerStats.get(b.seller.id);
    if (existing) {
      existing.count++;
      existing.totalRefunded += b.totalCost;
    } else {
      sellerStats.set(b.seller.id, {
        sellerId: b.seller.id,
        displayName: b.seller.displayName,
        email: b.seller.email,
        count: 1,
        totalRefunded: b.totalCost,
        suspended: !!b.seller.suspendedUntil,
      });
    }
  }
  const topOffenders = Array.from(sellerStats.values())
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Niet-verzonden bestellingen"
        subtitle="Bundles die automatisch zijn geannuleerd door de cron omdat de verkoper niet binnen 14 dagen heeft verzonden. Repeat-offenders kun je hieronder direct identificeren — herhaaldelijk niet-verzenden is grond voor suspensie."
      />

      {/* Top-offenders sectie — alleen sellers met 2+ events */}
      {topOffenders.length > 0 && (
        <DashboardSection
          variant="plain"
          title={`Repeat-offenders (${topOffenders.length})`}
          icon={<AlertTriangle className="size-5 text-rose-600 dark:text-rose-400" />}
        >
          <div className="overflow-x-auto dash-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Verkoper</th>
                  <th className="px-4 py-2.5 text-right">Aantal</th>
                  <th className="px-4 py-2.5 text-right">Totaal refund</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topOffenders.map((s) => (
                  <tr key={s.sellerId} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{s.displayName}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-rose-700 dark:text-rose-400">
                      {s.count}×
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">€{s.totalRefunded.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {s.suspended ? (
                        <StatusBadge tone="danger" icon={Ban}>Suspended</StatusBadge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Actief</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/admin/users/${s.sellerId}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Bekijk profiel
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}

      {/* Alle events — chronologisch */}
      <DashboardSection variant="plain" title={`Alle events (${bundles.length})`}>
        {bundles.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="Geen automatisch geannuleerde bundles." compact />
        ) : (
          <ul className="divide-y divide-border dash-card">
            {bundles.map((b) => {
              const rejectedCancel = b.cancellationRequests[0];
              // Highlight: seller wees een cancel af (was respondedById), daarna alsnog niet verzonden
              const sellerRejectedThenGhosted = rejectedCancel
                && rejectedCancel.proposedById === b.buyer.id
                && rejectedCancel.respondedAt !== null;
              return (
                <li key={b.id} className={`px-4 py-3 ${sellerRejectedThenGhosted ? "bg-red-500/5" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{b.orderNumber}</code>
                        <span className="text-sm font-medium text-foreground">
                          {b.seller.displayName}
                        </span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-sm text-muted-foreground">{b.buyer.displayName}</span>
                        {sellerRejectedThenGhosted && (
                          <StatusBadge tone="danger" icon={AlertTriangle}>Wees cancel af</StatusBadge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Besteld {b.createdAt.toLocaleDateString("nl-NL")}</span>
                        <span>·</span>
                        <span>Auto-geannuleerd {b.autoExpiredAt?.toLocaleDateString("nl-NL")}</span>
                        <span>·</span>
                        <span className="font-medium text-foreground">€{b.totalCost.toFixed(2)} terug</span>
                      </div>
                      {sellerRejectedThenGhosted && rejectedCancel.rejectionNote && (
                        <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-400/80 italic">
                          Afwijzingsreden seller: &ldquo;{rejectedCancel.rejectionNote}&rdquo;
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/admin/users/${b.seller.id}`}
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Profiel
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardSection>
    </div>
  );
}
