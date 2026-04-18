"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VariantPricing {
  key: string;              // "normal" | "reverse"
  label: string;            // "Normal" | "Reverse Holo" | "Holo"
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
}

export interface HistoryPoint {
  date: string;             // ISO "YYYY-MM-DD"
  normal: number | null;
  reverse: number | null;
}

export interface ExtraVariant {
  key: string;              // stable key, e.g. "master_ball"
  label: string;            // display label, e.g. "Master Ball Reverse Holo"
  priceEur: number;         // single-point NM/ungraded price from PriceCharting
}

interface Props {
  variants: VariantPricing[];
  history: HistoryPoint[];   // sorted ascending by date
  updated: string | null;
  extraVariants?: ExtraVariant[];
}

function formatEur(n: number | null) {
  if (n === null || n === undefined) return "—";
  return `€${n.toFixed(2)}`;
}

function delta(current: number | null, past: number | null) {
  if (current === null || past === null || past === 0) return null;
  return ((current - past) / past) * 100;
}

export function CardPricePanel({ variants, history, updated, extraVariants }: Props) {
  const [activeKey, setActiveKey] = useState(variants[0]?.key ?? "normal");
  const active = variants.find((v) => v.key === activeKey) ?? variants[0];
  if (!active) return null;

  // Extract per-day values for the active variant. A point is only included
  // if the variant had a value that day — so a fresh variant without history
  // doesn't pollute the chart with nulls.
  const field = active.key === "reverse" ? "reverse" : "normal";
  const series = history
    .map((h) => ({ date: h.date, price: h[field] }))
    .filter((p): p is { date: string; price: number } => p.price !== null);

  const deltaVs7d = delta(active.avg, active.avg7);
  const deltaVs30d = delta(active.avg, active.avg30);

  const trendIcon =
    deltaVs7d === null ? <Minus className="size-4" /> :
    deltaVs7d > 0.5 ? <TrendingUp className="size-4" /> :
    deltaVs7d < -0.5 ? <TrendingDown className="size-4" /> :
    <Minus className="size-4" />;

  const trendColor =
    deltaVs7d === null ? "text-muted-foreground" :
    deltaVs7d > 0.5 ? "text-emerald-600 dark:text-emerald-400" :
    deltaVs7d < -0.5 ? "text-red-600 dark:text-red-400" :
    "text-muted-foreground";

  const hasRealHistory = series.length >= 2;
  const firstDate = series[0]?.date;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">Marktwaarde</h3>
          <p className="mt-1 text-3xl font-bold text-foreground">{formatEur(active.avg)}</p>
          <div className={cn("mt-1 flex items-center gap-1 text-sm font-medium", trendColor)}>
            {trendIcon}
            {deltaVs7d !== null
              ? <span>{deltaVs7d > 0 ? "+" : ""}{deltaVs7d.toFixed(1)}% · 7 dagen</span>
              : <span>—</span>}
          </div>
        </div>

        {variants.length > 1 && (
          <div className="flex shrink-0 rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {variants.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setActiveKey(v.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors",
                  activeKey === v.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {hasRealHistory ? (
        <>
          <div className="mt-4 h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} className="text-primary" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} className="text-primary" />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  axisLine={false}
                  tickLine={false}
                  className="text-muted-foreground"
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                  minTickGap={24}
                />
                <YAxis hide domain={["dataMin - 0.05", "dataMax + 0.05"]} />
                <Tooltip
                  cursor={{ stroke: "currentColor", strokeOpacity: 0.2 }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                  formatter={(v: number) => [`€${v.toFixed(2)}`, active.label]}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="url(#priceFill)"
                  className="text-primary"
                  dot={{ r: 2.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {series.length} dag{series.length === 1 ? "" : "en"} historie
            {firstDate && ` · sinds ${new Date(firstDate).toLocaleDateString("nl-NL")}`}
          </p>
        </>
      ) : (
        <>
          <div className="mt-4 h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { label: "30d gem.", value: active.avg30 ?? 0 },
                  { label: "7d gem.", value: active.avg7 ?? 0 },
                  { label: "Nu", value: active.avg ?? 0 },
                ]}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  axisLine={false}
                  tickLine={false}
                  className="text-muted-foreground"
                />
                <YAxis hide domain={[0, "dataMax + 0.1"]} />
                <Tooltip
                  cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`€${v.toFixed(2)}`, "Gemiddelde"]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {[0, 1, 2].map((i) => (
                    <Cell key={i} className="fill-primary" fillOpacity={0.5 + i * 0.25} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Dagelijkse historie wordt nog verzameld — kom morgen terug voor een lijngrafiek.
          </p>
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label="Laagste" value={formatEur(active.low)} />
        <Stat label="Trend" value={formatEur(active.trend)} />
        <Stat label="7d gem." value={formatEur(active.avg7)} />
        <Stat
          label="30d gem."
          value={formatEur(active.avg30)}
          sub={deltaVs30d !== null ? `${deltaVs30d > 0 ? "+" : ""}${deltaVs30d.toFixed(1)}%` : undefined}
        />
      </div>

      {extraVariants && extraVariants.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Speciale varianten
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {extraVariants.map((v) => (
              <div
                key={v.key}
                className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 dark:border-purple-900/40 dark:bg-purple-950/30"
              >
                <span className="text-sm font-medium text-purple-900 dark:text-purple-200">
                  {v.label}
                </span>
                <span className="text-sm font-bold tabular-nums text-purple-900 dark:text-purple-200">
                  €{v.priceEur.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Prijzen via PriceCharting (NM ongegradeerd, omgerekend naar EUR)
          </p>
        </div>
      )}

      {updated && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Laatst bijgewerkt: {new Date(updated).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
