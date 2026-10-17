import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Search, Ban, ShieldCheck, AlertCircle } from "lucide-react";
import { isUserSuspended } from "@/lib/suspension";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { INPUT, SELECT, PILL_RED, PILL_BTN_SM, TABLE_HEAD } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type Filter = "" | "suspended" | "unverified" | "admin";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: Filter; page?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const filter: Filter = (sp.filter ?? "") as Filter;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const conditions: object[] = [];
  if (query) {
    conditions.push({
      OR: [
        { displayName: { contains: query } },
        { email: { contains: query } },
        { id: { contains: query } },
        { iban: { contains: query.toUpperCase().replace(/\s/g, "") } },
        { bankTransferReference: { contains: query } },
      ],
    });
  }
  if (filter === "suspended") {
    const now = new Date();
    conditions.push({
      OR: [
        { suspensionType: "PERMANENT" },
        { suspendedUntil: { gt: now } },
      ],
    });
  } else if (filter === "unverified") {
    conditions.push({ isVerified: false });
  } else if (filter === "admin") {
    conditions.push({ accountType: "ADMIN" });
  }
  const baseWhere = conditions.length > 0 ? { AND: conditions } : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where: baseWhere }),
    prisma.user.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        displayName: true,
        email: true,
        accountType: true,
        balance: true,
        isVerified: true,
        suspendedUntil: true,
        suspensionType: true,
        createdAt: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Users" subtitle={`${total} gebruikers`} />

      <form method="get" className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Naam, email, id, IBAN of reference"
            className={`${INPUT} pl-9`}
          />
        </div>
        <select
          name="filter"
          defaultValue={filter}
          className={cn(SELECT, "w-auto")}
        >
          <option value="">Alle gebruikers</option>
          <option value="suspended">Alleen opgeschort</option>
          <option value="unverified">Alleen ongeverifieerd</option>
          <option value="admin">Alleen admins</option>
        </select>
        <button
          type="submit"
          className={PILL_RED}
        >
          Zoek
        </button>
      </form>

      <div className="overflow-x-auto dash-card">
        <table className="w-full text-sm">
          <thead className={`${TABLE_HEAD} bg-[var(--background)]`}>
            <tr>
              <th className="px-4 py-2.5">Username</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5 text-right">Saldo</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Sinds</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Geen resultaten.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const suspended = isUserSuspended(u);
              return (
                <tr key={u.id} className="hover:bg-[var(--background)]">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/dashboard/admin/users/${u.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {u.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <code className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                      {u.accountType}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">€{u.balance.toFixed(2)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-1">
                      {suspended && (
                        <StatusBadge tone="danger" icon={Ban}>
                          {u.suspensionType === "PERMANENT" ? "Permanent" : "Tijdelijk"}
                        </StatusBadge>
                      )}
                      {u.isVerified ? (
                        <StatusBadge tone="success" icon={ShieldCheck}>Verified</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral" icon={AlertCircle}>Unverified</StatusBadge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {u.createdAt.toLocaleDateString("nl-NL")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pagina {page} van {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{ pathname: "/dashboard/admin/users", query: { ...sp, page: String(page - 1) } }}
                className={PILL_BTN_SM}
              >
                Vorige
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={{ pathname: "/dashboard/admin/users", query: { ...sp, page: String(page + 1) } }}
                className={PILL_BTN_SM}
              >
                Volgende
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
