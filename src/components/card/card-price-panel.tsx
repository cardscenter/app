"use client";

import { useEffect, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp, Minus, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { quadraticTrend } from "@/lib/price-trend";

export interface VariantPricing {
  key: string;              // "normal" | "reverse"
  label: string;            // "Normal" | "Reverse Holo" | "Holo"
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
  /**
   * Server-computed Marktprijs-delta per periode (dagen: 7/14/30/90/365).
   * Apples-to-apples — beide kanten door dezelfde outlier-filter. Voor 7 en 30
   * dagen is er een raw priceAvg/avg7/avg30-fallback; 14/90/365 zijn puur
   * snapshot-gebaseerd (null als er nog geen historie ~N dagen terug is).
   * Sinds de trend-percentages is dit de FALLBACK — het getoonde percentage
   * komt primair uit de trendlijn-fit over de getoonde grafiekreeks.
   */
  deltas: Record<number, number | null>;
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
  /** PRO+ mag 90d + 1j kiezen. FREE krijgt die data niet eens binnen (server
   *  begrenst het venster op 35 dagen) — de 90d/1j-tabs tonen een slotje. */
  canExtendedHistory?: boolean;
}

// Klikbare periodes boven de grafiek. 7d/14d/30d gratis, 60d/120d/365d achter PRO.
const PERIODS = [
  { days: 7, label: "7d", pro: false },
  { days: 14, label: "14d", pro: false },
  { days: 30, label: "30d", pro: false },
  { days: 60, label: "60d", pro: true },
  { days: 120, label: "120d", pro: true },
  { days: 365, label: "365d", pro: true },
] as const;

// Delta-label per periode (getoond naast het percentage onder Marktwaarde).
const DELTA_LABELS: Record<number, string> = {
  7: "7 dagen",
  14: "14 dagen",
  30: "30 dagen",
  60: "60 dagen",
  120: "120 dagen",
  365: "365 dagen",
};

function formatEur(n: number | null) {
  if (n === null || n === undefined) return "—";
  return `€${n.toFixed(2)}`;
}

// Trendlijn-fit gedeeld met de /kaarten stijgers-berekening (server) zodat
// grafiek-lijn en percentages overal dezelfde wiskunde gebruiken.

export function CardPricePanel({ variants, history, updated, extraVariants, canExtendedHistory = false }: Props) {
  const [activeKey, setActiveKey] = useState(variants[0]?.key ?? "normal");
  // Default 30d zodra er genoeg historie is, anders 14d. Span uit de ruwe
  // history (variant-onafhankelijk) zodat deze initializer stabiel is.
  const overallSpanDays = history.length >= 2
    ? Math.round((Date.parse(history[history.length - 1].date) - Date.parse(history[0].date)) / 86400000)
    : 0;
  const [periodDays, setPeriodDays] = useState<number>(
    overallSpanDays >= 14 ? 30 : overallSpanDays >= 7 ? 14 : 7,
  );
  // Vertel de kaartafbeelding (server-gerenderd, elders op de pagina) welke
  // variant actief is — die toont bij "reverse" een holo-glans-overlay. Zelfde
  // custom-DOM-event-patroon als cart-checkout-locked.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("card-variant-changed", { detail: { variantKey: activeKey } }),
    );
  }, [activeKey]);

  const active = variants.find((v) => v.key === activeKey) ?? variants[0];
  if (!active) return null;

  // Extract per-day values for the active variant. A point is only included
  // if the variant had a value that day — so a fresh variant without history
  // doesn't pollute the chart with nulls.
  const field = active.key === "reverse" ? "reverse" : "normal";
  const fullSeries = history
    .map((h) => ({ date: h.date, price: h[field] }))
    .filter((p): p is { date: string; price: number } => p.price !== null);

  // Hoeveel dagen historie heeft DEZE variant? Bepaalt welke periode-tabs nog
  // iets nieuws tonen (een 90d-tab op 12 dagen data = identieke grafiek).
  const variantSpanDays = fullSeries.length >= 2
    ? Math.round((Date.parse(fullSeries[fullSeries.length - 1].date) - Date.parse(fullSeries[0].date)) / 86400000)
    : 0;
  const isLocked = (pro: boolean) => pro && !canExtendedHistory;
  const isRedundant = (days: number) => {
    // Een langere tab is redundant als DEZE variant niet eens tot de vorige
    // tab-grens aan historie heeft (zelfde grafiek). Kortste tab (7d) nooit.
    const ladder = [7, 14, 30, 60, 120, 365];
    const idx = ladder.indexOf(days);
    if (idx <= 0) return false;
    return variantSpanDays <= ladder[idx - 1];
  };

  // Klem de actieve periode omlaag als de gekozen tab gelockt/redundant is, zodat
  // de gemarkeerde tab en de getoonde grafiek nooit uit elkaar lopen.
  const effectivePeriodDays = (() => {
    const sel = PERIODS.find((p) => p.days === periodDays);
    if (sel && !isLocked(sel.pro) && !isRedundant(sel.days)) return sel.days;
    const fallback = [...PERIODS].reverse().find((p) => !isLocked(p.pro) && !isRedundant(p.days));
    return fallback?.days ?? 14;
  })();

  const cutoffMs = Date.now() - effectivePeriodDays * 86400000;
  const windowed = fullSeries.filter((p) => Date.parse(p.date) >= cutoffMs);
  const series = windowed.length >= 2 ? windowed : fullSeries;

  // Trendlijn over de getoonde reeks — voor ALLE periodes. Vanaf 30d prominent
  // (amber), bij 7d/14d subtiel lichtgrijs (voegt daar visueel weinig toe maar
  // is wél de bron van het percentage). Het getoonde percentage = begin→eind
  // van deze lijn, zodat één toevallige piek/dip aan een venstergrens geen
  // absurde delta's meer geeft en grafiek + getal altijd hetzelfde vertellen.
  const trendVals = quadraticTrend(series.map((p) => p.price));
  const trendDelta = trendVals && trendVals[0] > 0
    ? ((trendVals[trendVals.length - 1] - trendVals[0]) / trendVals[0]) * 100
    : null;
  // Fallback bij te weinig punten voor een fit: de server-berekende
  // snapshot-delta (Marktprijs vandaag vs ~N dagen terug, apples-to-apples).
  const activeDelta = trendDelta ?? active.deltas[effectivePeriodDays] ?? null;
  const deltaVs30d = active.deltas[30] ?? null;

  const trendIcon =
    activeDelta === null ? <Minus className="size-4" /> :
    activeDelta > 0.5 ? <TrendingUp className="size-4" /> :
    activeDelta < -0.5 ? <TrendingDown className="size-4" /> :
    <Minus className="size-4" />;

  const trendColor =
    activeDelta === null ? "text-muted-foreground" :
    activeDelta > 0.5 ? "text-emerald-600 dark:text-emerald-400" :
    activeDelta < -0.5 ? "text-red-600 dark:text-red-400" :
    "text-muted-foreground";

  const hasRealHistory = series.length >= 2;
  const firstDate = series[0]?.date;

  const chartData = trendVals
    ? series.map((p, i) => ({ ...p, trend: trendVals[i] }))
    : series;
  // Bij korte periodes is de lijn een subtiel hulpmiddel, geen blikvanger.
  const subtleTrendLine = effectivePeriodDays < 30;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {hasRealHistory && (
        <div className="mb-4 grid grid-cols-6 gap-1 rounded-xl border border-border bg-muted/40 p-1 text-xs font-medium">
          {PERIODS.map((p) => {
            if (isLocked(p.pro)) {
              return (
                <Link
                  key={p.days}
                  href="/dashboard/abonnement"
                  className="flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-muted-foreground/50 transition-colors hover:bg-background/60 hover:text-foreground"
                >
                  <Lock className="size-3" />
                  {p.label}
                </Link>
              );
            }
            const redundant = isRedundant(p.days);
            const isActive = p.days === effectivePeriodDays;
            return (
              <button
                key={p.days}
                type="button"
                disabled={redundant}
                onClick={() => setPeriodDays(p.days)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-center transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  redundant && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">Marktwaarde</h3>
          <p className="mt-1 text-3xl font-bold text-foreground">{formatEur(active.avg)}</p>
          <div className={cn("mt-1 flex items-center gap-1 text-sm font-medium", trendColor)}>
            {trendIcon}
            {activeDelta !== null
              ? <span>{activeDelta > 0 ? "+" : ""}{activeDelta.toFixed(1)}% · {trendDelta !== null ? "trend " : ""}{DELTA_LABELS[effectivePeriodDays] ?? `${effectivePeriodDays} dagen`}</span>
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
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
                  formatter={((v: number, name: string) =>
                    [`€${v.toFixed(2)}`, name === "trend" ? "Trendlijn" : active.label]) as never}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="url(#priceFill)"
                  className="text-primary"
                  dot={series.length > 45 ? false : { r: 2.5 }}
                />
                {trendVals && (
                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke="currentColor"
                    strokeWidth={subtleTrendLine ? 1.5 : 2}
                    strokeDasharray="6 4"
                    className={subtleTrendLine
                      ? "text-slate-400/70 dark:text-slate-500/70"
                      : "text-amber-500 dark:text-amber-400"}
                    dot={false}
                    activeDot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {series.length} dag{series.length === 1 ? "" : "en"} historie
            {firstDate && ` · sinds ${new Date(firstDate).toLocaleDateString("nl-NL")}`}
            {trendVals && " · stippellijn = trend"}
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
                  formatter={((v: number) => [`€${v.toFixed(2)}`, "Gemiddelde"]) as never}
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
            Prijzen via TCGPlayer Holofoil — omgerekend naar EUR met EU/US tier-correctie
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
