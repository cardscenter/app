import { TrendingDown, TrendingUp, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PricingSnapshot {
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg7: number | null;
  avg30: number | null;
  updated: string | null;
}

interface Props {
  pricing: PricingSnapshot | null | undefined;
  /** "compact" hides the meta line; "full" shows updated date + breakdown. */
  variant?: "compact" | "full";
  className?: string;
  /** Optional label override (default: "CardMarket"). */
  label?: string;
}

function formatEur(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `€${value.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function trendDelta(current: number | null, previous: number | null): { pct: number; dir: "up" | "down" | "flat" } | null {
  if (current === null || previous === null || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { pct, dir: "up" };
  if (pct < 0) return { pct: Math.abs(pct), dir: "down" };
  return { pct: 0, dir: "flat" };
}

export function PricingInfoBlock({ pricing, variant = "compact", className, label = "CardMarket" }: Props) {
  if (!pricing || pricing.avg === null) {
    return null;
  }

  // Use 7-day delta as the main trend signal — most recent meaningful change
  const delta7 = trendDelta(pricing.avg, pricing.avg7);

  return (
    <div className={cn("rounded-xl border border-border bg-muted/30 p-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        </div>
        {delta7 && (
          <div className={cn(
            "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
            delta7.dir === "up" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            delta7.dir === "down" && "bg-red-500/10 text-red-600 dark:text-red-400",
            delta7.dir === "flat" && "bg-muted text-muted-foreground",
          )}>
            {delta7.dir === "up" && <TrendingUp className="size-3" />}
            {delta7.dir === "down" && <TrendingDown className="size-3" />}
            {delta7.dir === "flat" && <Minus className="size-3" />}
            {delta7.pct}% / 7d
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{formatEur(pricing.avg)}</span>
        <span className="text-xs text-muted-foreground">gemiddeld</span>
      </div>

      {variant === "full" && (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Laagste</p>
            <p className="font-semibold text-foreground">{formatEur(pricing.low)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">7d gem.</p>
            <p className="font-semibold text-foreground">{formatEur(pricing.avg7)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">30d gem.</p>
            <p className="font-semibold text-foreground">{formatEur(pricing.avg30)}</p>
          </div>
        </div>
      )}

      {variant === "full" && pricing.updated && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Bijgewerkt: {new Date(pricing.updated).toLocaleDateString("nl-NL")}
        </p>
      )}
    </div>
  );
}
