import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FinanceTabs } from "@/components/dashboard/cluster-tabs";
import { EmptyState } from "@/components/dashboard/ui/empty-state";

export default async function PendingFeesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const fees = await prisma.pendingPlatformFee.findMany({
    where: { userId: session.user.id },
    orderBy: [{ settledAt: "asc" }, { createdAt: "desc" }],
  });

  const open = fees.filter((f) => f.settledAt === null);
  const settled = fees.filter((f) => f.settledAt !== null);
  const openTotal = Math.round(open.reduce((s, f) => s + f.amount, 0) * 100) / 100;

  return (
    <div className="space-y-6">
      <FinanceTabs />

      <p className="text-sm text-muted-foreground">
        Niet-inbare boetes/borgen worden geregistreerd als schuld en automatisch
        verrekend bij je volgende inkomst (deposit, verkoop, refund).
      </p>

      {fees.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Geen openstaande kosten"
          description="Je hebt geen openstaande of afgeloste platformkosten."
        />
      ) : (
        <>
          {open.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
                <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                Open ({open.length}) — €{openTotal.toFixed(2)}
              </h2>
              <div className="space-y-2">
                {open.map((fee) => (
                  <div
                    key={fee.id}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{fee.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {fee.type === "BID_DEPOSIT_FORFEIT" ? "Borg" : "Veilingkosten"} ·{" "}
                          {new Date(fee.createdAt).toLocaleDateString("nl-NL", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">€{fee.amount.toFixed(2)}</p>
                        {fee.amount < fee.originalAmount && (
                          <p className="text-xs text-muted-foreground">
                            van €{fee.originalAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {settled.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                Afgelost ({settled.length})
              </h2>
              <div className="space-y-2">
                {settled.map((fee) => (
                  <div
                    key={fee.id}
                    className="rounded-xl border border-border bg-card p-4 opacity-70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{fee.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {fee.type === "BID_DEPOSIT_FORFEIT" ? "Borg" : "Veilingkosten"} · afgelost op{" "}
                          {fee.settledAt &&
                            new Date(fee.settledAt).toLocaleDateString("nl-NL", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground line-through">
                          €{fee.originalAmount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
