import { prisma } from "@/lib/prisma";
import { BankTransferForm } from "@/components/admin/bank-transfer-form";
import { Search, CreditCard } from "lucide-react";
import { Link } from "@/i18n/navigation";

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
      <div>
        <h1 className="text-2xl font-bold">Banktransfers bevestigen</h1>
        <p className="text-sm text-muted-foreground">
          Zoek een gebruiker op naam, e-mailadres of bank-reference, en bevestig de ontvangen overboeking.
          Het bedrag wordt direct toegevoegd aan hun saldo en gelogd in de audit log.
        </p>
      </div>

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
          className="rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Zoek
        </button>
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            {query ? `Resultaten voor "${query}" (${matches.length})` : "Zoekresultaten"}
          </h2>
          {!query && (
            <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
              <CreditCard className="mx-auto mb-2 h-6 w-6 opacity-40" />
              Vul een zoekterm in om gebruikers te vinden.
            </div>
          )}
          {query && matches.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
              Geen gebruikers gevonden voor &quot;{query}&quot;.
            </div>
          )}
          {matches.length > 0 && (
            <div className="space-y-3">
              {matches.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-card"
                >
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
        </section>

        <aside>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            Laatste bevestigingen
          </h2>
          <div className="space-y-2">
            {recent.length === 0 && (
              <p className="rounded-xl border border-dashed border-border bg-muted p-4 text-center text-xs text-muted-foreground">
                Nog geen bevestigingen gelogd.
              </p>
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
                <div key={r.id} className="rounded-lg border border-border bg-card p-3 text-xs shadow-card">
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
        </aside>
      </div>
    </div>
  );
}
