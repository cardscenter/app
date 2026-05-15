import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { History } from "lucide-react";

const PAGE_SIZE = 50;

const ACTIONS = [
  "SUSPEND_USER",
  "LIFT_SUSPENSION",
  "APPROVE_WITHDRAWAL",
  "REJECT_WITHDRAWAL",
  "MARK_PAID",
  "ADMIN_RESOLVE_DISPUTE",
  "REVIEW_VERIFICATION",
  "UPDATE_BUYBACK_STATUS",
  "CONFIRM_BANK_TRANSFER",
  "REVIEW_REPORT",
  "UPDATE_APP_CONFIG",
  "EDIT_SERIES",
  "EDIT_CARDSET",
  "EDIT_CARD",
  "RUN_CRON_MANUALLY",
  "BULK_REMOVE_LISTINGS",
  "BULK_REMOVE_AUCTIONS",
  "BULK_REMOVE_CLAIMSALES",
  "RESET_IBAN_COOLDOWN",
  "FORCE_USERNAME_RESET",
] as const;

const TARGET_TYPES = [
  "USER",
  "WITHDRAWAL",
  "DISPUTE",
  "VERIFICATION",
  "BUYBACK",
  "LISTING",
  "AUCTION",
  "CLAIMSALE",
  "APP_CONFIG",
  "SERIES",
  "CARDSET",
  "CARD",
  "CRON",
  "REPORT",
] as const;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    targetType?: string;
    targetId?: string;
    page?: string;
  }>;
}) {
  const t = await getTranslations("admin");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10));

  const where: {
    action?: string;
    targetType?: string;
    targetId?: { contains: string };
  } = {};
  if (sp.action && ACTIONS.includes(sp.action as (typeof ACTIONS)[number])) where.action = sp.action;
  if (sp.targetType && TARGET_TYPES.includes(sp.targetType as (typeof TARGET_TYPES)[number])) where.targetType = sp.targetType;
  if (sp.targetId?.trim()) where.targetId = { contains: sp.targetId.trim() };

  const [total, entries] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        admin: { select: { id: true, displayName: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("navAudit")}</h1>
        <p className="text-sm text-muted-foreground">{total} entries</p>
      </div>

      <form className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3 shadow-card" method="get">
        <select
          name="action"
          defaultValue={sp.action ?? ""}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        >
          <option value="">— Alle actions —</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          name="targetType"
          defaultValue={sp.targetType ?? ""}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        >
          <option value="">— Alle target-types —</option>
          {TARGET_TYPES.map((tt) => (
            <option key={tt} value={tt}>{tt}</option>
          ))}
        </select>
        <input
          type="text"
          name="targetId"
          defaultValue={sp.targetId ?? ""}
          placeholder="targetId bevat…"
          className="flex-1 min-w-[150px] rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Filter
        </button>
        <Link
          href="/dashboard/admin/audit"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          Reset
        </Link>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Tijdstip</th>
              <th className="px-3 py-2 font-medium">Admin</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-muted-foreground">
                  <History className="mx-auto mb-2 h-6 w-6 opacity-40" />
                  {t("noRecentActivity")}
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-border align-top">
                <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {e.createdAt.toLocaleString("nl-NL")}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {e.admin ? (
                    <Link
                      href={`/dashboard/admin/users/${e.admin.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {e.admin.displayName}
                    </Link>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">systeem</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{e.action}</code>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="text-xs text-muted-foreground">{e.targetType}</span>
                  {e.targetId && (
                    <>
                      <br />
                      <code className="text-xs">{e.targetId}</code>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 max-w-md">
                  {e.metadata && (
                    <pre className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(e.metadata), null, 0);
                        } catch {
                          return e.metadata;
                        }
                      })()}
                    </pre>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pagina {page} van {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{
                  pathname: "/dashboard/admin/audit",
                  query: { ...sp, page: String(page - 1) },
                }}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                Vorige
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={{
                  pathname: "/dashboard/admin/audit",
                  query: { ...sp, page: String(page + 1) },
                }}
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
