import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Search, Ban, ShieldCheck, AlertCircle } from "lucide-react";
import { isUserSuspended } from "@/lib/suspension";

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
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">{total} gebruikers</p>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Naam, email, id, IBAN of reference"
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          name="filter"
          defaultValue={filter}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">Alle gebruikers</option>
          <option value="suspended">Alleen opgeschort</option>
          <option value="unverified">Alleen ongeverifieerd</option>
          <option value="admin">Alleen admins</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Zoek
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Username</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium text-right">Saldo</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Sinds</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">
                  Geen resultaten.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const suspended = isUserSuspended(u);
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link
                      href={`/dashboard/admin/users/${u.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {u.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                      {u.accountType}
                    </code>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">€{u.balance.toFixed(2)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-1">
                      {suspended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                          <Ban className="h-3 w-3" /> {u.suspensionType === "PERMANENT" ? "Permanent" : "Tijdelijk"}
                        </span>
                      )}
                      {u.isVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <AlertCircle className="h-3 w-3" /> Unverified
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
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
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                Vorige
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={{ pathname: "/dashboard/admin/users", query: { ...sp, page: String(page + 1) } }}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
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
