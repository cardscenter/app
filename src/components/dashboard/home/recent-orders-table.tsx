import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Activity, ArrowDownLeft, ArrowUpRight, Package } from "lucide-react";
import type { RecentOrderRow } from "@/lib/dashboard-queries";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";

// "Recente activiteit"-tabel: verkopen en aankopen door elkaar, nieuwste
// eerst. Kolommen als in de referentie: type · bedrag · status · tegenpartij.

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral" | "primary"> = {
  PAID: "primary",
  SCHEDULED: "info",
  SHIPPED: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral",
  DISPUTED: "danger",
};

type Props = { rows: RecentOrderRow[] };

export async function RecentOrdersTable({ rows }: Props) {
  const t = await getTranslations("dashboard.home");
  const ts = await getTranslations("dashboard.home.status");

  return (
    <section className="overflow-hidden dash-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          <h2 className="text-[15px] font-semibold text-foreground">{t("recentActivity")}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <Link href="/dashboard/verkopen" className="rounded-md border border-border bg-card px-3 py-1.5 text-foreground transition-colors hover:bg-muted">
            {t("allSales")}
          </Link>
          <Link href="/dashboard/aankopen" className="rounded-md border border-border bg-card px-3 py-1.5 text-foreground transition-colors hover:bg-muted">
            {t("allPurchases")}
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={Package} title={t("noOrders")} description={t("noOrdersDesc")} compact />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">{t("colType")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("colAmount")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("colStatus")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("colCounterparty")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const isSale = r.role === "sale";
                const href = isSale ? "/dashboard/verkopen" : "/dashboard/aankopen";
                return (
                  <tr key={r.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={href} className="flex items-center gap-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                            isSale
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {isSale ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-[260px] truncate font-medium text-foreground">
                            {r.itemTitle ?? `#${r.orderNumber}`}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {isSale ? t("sale") : t("purchase")} · {formatDateShort(r.createdAt)}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 font-semibold tabular-nums ${isSale ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                      {isSale ? "+" : "−"}&nbsp;{formatCurrency(r.totalCost)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>{ts(r.status as never) || r.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.counterpartyName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
