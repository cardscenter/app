import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, ExternalLink, Ban } from "lucide-react";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
          Niet-verzonden bestellingen
        </h1>
        <p className="text-sm text-muted-foreground">
          Bundles die automatisch zijn geannuleerd door de cron omdat de verkoper niet binnen 14 dagen heeft verzonden.
          Repeat-offenders kun je hieronder direct identificeren — herhaaldelijk niet-verzenden is grond voor suspensie.
        </p>
      </div>

      {/* Top-offenders sectie — alleen sellers met 2+ events */}
      {topOffenders.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            Repeat-offenders ({topOffenders.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="px-4 py-2">Verkoper</th>
                  <th className="px-4 py-2 text-right">Aantal</th>
                  <th className="px-4 py-2 text-right">Totaal refund</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topOffenders.map((s) => (
                  <tr key={s.sellerId} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <div className="font-medium text-foreground">{s.displayName}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-bold text-rose-700 dark:text-rose-400">
                      {s.count}×
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">€{s.totalRefunded.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      {s.suspended ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                          <Ban className="h-3 w-3" />
                          Suspended
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Actief</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
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
        </section>
      )}

      {/* Alle events — chronologisch */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
          Alle events ({bundles.length})
        </h2>
        {bundles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center">
            <p className="text-sm text-muted-foreground">Geen automatisch geannuleerde bundles.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {bundles.map((b) => {
              const rejectedCancel = b.cancellationRequests[0];
              // Highlight: seller wees een cancel af (was respondedById), daarna alsnog niet verzonden
              const sellerRejectedThenGhosted = rejectedCancel
                && rejectedCancel.proposedById === b.buyer.id
                && rejectedCancel.respondedAt !== null;
              return (
                <li key={b.id} className={`px-4 py-3 ${sellerRejectedThenGhosted ? "bg-rose-50/50 dark:bg-rose-950/20" : ""}`}>
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
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                            <AlertTriangle className="h-3 w-3" />
                            Wees cancel af
                          </span>
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
      </section>
    </div>
  );
}
