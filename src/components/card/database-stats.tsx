import { Database, Layers, TrendingUp, Sparkles, Info } from "lucide-react";

interface Props {
  totalCards: number;
  totalSets: number;
  totalMarketValueEur: number;
  latestSetName: string | null;
  latestSetSlug: string | null;
}

function formatFullEur(n: number): string {
  return `€${Math.round(n).toLocaleString("nl-NL")}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("nl-NL");
}

export function DatabaseStats({
  totalCards,
  totalSets,
  totalMarketValueEur,
  latestSetName,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        icon={<Database className="size-5" />}
        label="Kaarten"
        value={formatNumber(totalCards)}
      />
      <StatTile
        icon={<Layers className="size-5" />}
        label="Sets"
        value={formatNumber(totalSets)}
      />
      <StatTile
        icon={<TrendingUp className="size-5" />}
        label="Totale marktwaarde"
        value={formatFullEur(totalMarketValueEur)}
        tooltip="Marktwaarde van Engelstalige kaarten, raw in near mint conditie."
      />
      <StatTile
        icon={<Sparkles className="size-5" />}
        label="Nieuwste set"
        value={latestSetName ?? "—"}
      />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {tooltip && (
            <span className="group relative inline-flex">
              <Info
                className="size-3 cursor-help text-muted-foreground/70 transition-colors hover:text-foreground"
                aria-label={tooltip}
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 w-56 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
              >
                {tooltip}
              </span>
            </span>
          )}
        </div>
        <p className="text-base font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
