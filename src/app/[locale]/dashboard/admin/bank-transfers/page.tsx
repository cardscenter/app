import { prisma } from "@/lib/prisma";
import { BankTransferForm } from "@/components/admin/bank-transfer-form";
import { Search, CreditCard, History } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { EmptyState } from "@/components/dashboard/ui/empty-state";

export default async function BankTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const matches = query
    ? await prisma.user.findMany({
        where: {
          OR: [
            { displayName: { contains: query } },
            { bankTransferReference: { contains: query } },
            { email: { contains: query } },
          ],
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          balance: true,
          bankTransferReference: true,
          accountType: true,
          iban: true,
          isIbanVerified: true,
        },
        take: 20,
        orderBy: { displayName: "asc" },
      })
    : [];

  const recent = await prisma.adminAuditLog.findMany({
    where: { action: "CONFIRM_BANK_TRANSFER" },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { admin: { select: { displayName: true } } },
  });

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Banktransfers bevestigen"
        subtitle="Zoek een gebruiker op naam, e-mailadres of bank-reference, en bevestig de ontvangen overboeking. Het bedrag wordt direct toegevoegd aan hun saldo en gelogd in de audit log."
      />

      <form method="get" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Naam, email of reference (bv. atomicsnipz8729376290)"
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm"
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Zoek
        </button>
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <DashboardSection
          variant="plain"
          title={query ? `Resultaten voor "${query}" (${matches.length})` : "Zoekresultaten"}
        >
          {!query && (
            <EmptyState
              icon={CreditCard}
              title="Vul een zoekterm in om gebruikers te vinden."
              compact
            />
          )}
          {query && matches.length === 0 && (
            <EmptyState
              icon={Search}
              title={`Geen gebruikers gevonden voor "${query}".`}
              compact
            />
          )}
          {matches.length > 0 && (
            <div className="space-y-3">
              {matches.map((u) => (
                <div key={u.id} className="dash-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/admin/users/${u.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {u.displayName}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      {u.bankTransferReference && (
                        <p className="mt-1 text-xs">
                          Reference:{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                            {u.bankTransferReference}
                          </code>
                        </p>
                      )}
                      <p className="mt-1 text-sm">
                        Saldo: <span className="font-bold tabular-nums">€{u.balance.toFixed(2)}</span>
                      </p>
                    </div>
                    <BankTransferForm
                      userId={u.id}
                      userName={u.displayName}
                      currentBalance={u.balance}
                      userIban={u.iban}
                      isIbanVerified={u.isIbanVerified}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardSection>

        <DashboardSection variant="plain" title="Laatste bevestigingen">
          <div className="space-y-2">
            {recent.length === 0 && (
              <EmptyState icon={History} title="Nog geen bevestigingen gelogd." compact />
            )}
            {recent.map((r) => {
              let amount: number | null = null;
              let userName = "";
              try {
                const meta = r.metadata ? JSON.parse(r.metadata) : null;
                amount = meta?.amount ?? null;
                userName = meta?.userName ?? "";
              } catch {
                /* swallow */
              }
              return (
                <div key={r.id} className="dash-card p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">€{amount?.toFixed(2) ?? "?"}</span>
                    <span className="text-muted-foreground">{r.createdAt.toLocaleString("nl-NL")}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {userName || r.targetId} ← {r.admin?.displayName ?? "systeem"}
                  </p>
                </div>
              );
            })}
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
