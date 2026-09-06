"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowDownLeft, ArrowUpRight, ArrowUpDown, BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CashFlow } from "@/lib/dashboard-queries";
import { formatCurrency } from "@/lib/format";
import { ChangeIndicator } from "@/components/dashboard/statistics/change-indicator";

// Cash flow = verkopen (staven omhoog) vs aankopen (staven omlaag), met
// week/dag-toggle. Rechts de totalen van de periode met "vs vorige periode".

const SALES_COLOR = "#10b981"; // emerald-500 — geld erin
const PURCHASE_COLOR = "#3b82f6"; // blue-500 — geld eruit

type Props = { data: CashFlow; showStatsLink: boolean };

export function CashFlowCard({ data, showStatsLink }: Props) {
  const t = useTranslations("dashboard.home");
  const tp = useTranslations("dashboard.statistics");
  // Bij lange periodes is per dag te druk → standaard week.
  const [mode, setMode] = useState<"week" | "day">(data.days.length > 45 ? "week" : "day");

  const points = useMemo(() => {
    const src = mode === "week" ? data.weeks : data.days;
    // Aankopen negatief zodat ze onder de nul-lijn hangen.
    return src.map((p) => ({ ...p, purchasesNeg: -p.purchases }));
  }, [data, mode]);

  const hasData = data.current.sales > 0 || data.current.purchases > 0;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">{t("cashFlow")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium">
            {(["week", "day"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "week" ? t("weekly") : t("daily")}
              </button>
            ))}
          </div>
          {showStatsLink && (
            <Link
              href="/dashboard/statistieken"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <BarChart3 className="size-3.5" />
              {t("statistics")}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {hasData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={points} stackOffset="sign" barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => `€${Math.abs(v) >= 1000 ? `${Math.round(Math.abs(v) / 100) / 10}K` : Math.abs(v)}`}
                />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: "0.75rem",
                    color: "var(--foreground)",
                  }}
                  formatter={(value, name) => [
                    formatCurrency(Math.abs(Number(value ?? 0))),
                    String(name) === "sales" ? t("sales") : t("purchases"),
                  ]}
                />
                <Bar dataKey="sales" stackId="flow" fill={SALES_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="purchasesNeg" name="purchases" stackId="flow" fill={PURCHASE_COLOR} radius={[0, 0, 4, 4]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              {t("cashFlowEmpty")}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center divide-y divide-border lg:border-l lg:border-border lg:pl-6">
          <SummaryRow
            Icon={ArrowDownLeft}
            iconClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            label={t("sales")}
            value={data.current.sales}
            count={data.current.salesCount}
            countLabel={t("orders", { count: data.current.salesCount })}
            comparison={data.comparison.sales}
            vsLabel={tp("vsLastPeriod")}
          />
          <SummaryRow
            Icon={ArrowUpRight}
            iconClass="bg-blue-500/15 text-blue-600 dark:text-blue-400"
            label={t("purchases")}
            value={data.current.purchases}
            count={data.current.purchaseCount}
            countLabel={t("orders", { count: data.current.purchaseCount })}
            comparison={data.comparison.purchases}
            vsLabel={tp("vsLastPeriod")}
            invert
          />
        </div>
      </div>
    </section>
  );
}

function SummaryRow({
  Icon,
  iconClass,
  label,
  value,
  countLabel,
  comparison,
  vsLabel,
  invert,
}: {
  Icon: typeof ArrowUpRight;
  iconClass: string;
  label: string;
  value: number;
  count: number;
  countLabel: string;
  comparison: { change: number; direction: "up" | "down" | "flat" };
  vsLabel: string;
  invert?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-2xl font-bold tabular-nums text-foreground">{formatCurrency(value)}</p>
          <ChangeIndicator change={comparison.change} direction={comparison.direction} invert={invert} />
        </div>
        <p className="text-xs text-muted-foreground">
          {countLabel} · {vsLabel}
        </p>
      </div>
    </div>
  );
}
