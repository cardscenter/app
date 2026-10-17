import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Activity, ArrowDownLeft, ArrowUpRight, Package } from "lucide-react";
import type { RecentOrderRow } from "@/lib/dashboard-queries";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { TONE_ICON } from "@/components/dashboard/ui/tones";
import { PILL_BTN_SM, TABLE_CELL, TABLE_HEAD } from "@/components/ploy/tile-styles";

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
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">{t("recentActivity")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/verkopen" className={PILL_BTN_SM}>
            {t("allSales")}
          </Link>
          <Link href="/dashboard/aankopen" className={PILL_BTN_SM}>
            {t("allPurchases")}
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <EmptyState icon={Package} title={t("noOrders")} description={t("noOrdersDesc")} compact />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`${TABLE_HEAD} bg-[var(--background)]`}>
              <tr>
                <th className={TABLE_CELL}>{t("colType")}</th>
                <th className={TABLE_CELL}>{t("colAmount")}</th>
                <th className={TABLE_CELL}>{t("colStatus")}</th>
                <th className={TABLE_CELL}>{t("colCounterparty")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const isSale = r.role === "sale";
                const href = isSale ? "/dashboard/verkopen" : "/dashboard/aankopen";
                return (
                  <tr key={r.id} className="transition-colors hover:bg-[var(--background)]">
                    <td className="px-4 py-3">
                      <Link href={href} className="flex items-center gap-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${isSale ? TONE_ICON.green : TONE_ICON.pink}`}
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
                    <td className={`whitespace-nowrap px-4 py-3 font-semibold tabular-nums ${isSale ? "text-[var(--pastel-green-ink)]" : "text-foreground"}`}>
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
