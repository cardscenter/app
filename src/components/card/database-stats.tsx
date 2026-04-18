import { Database, Layers, TrendingUp, Sparkles } from "lucide-react";

interface Props {
  totalCards: number;
  totalSets: number;
  totalMarketValueEur: number;
  latestSetName: string | null;
  latestSetSlug: string | null;
}

function formatEur(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}k`;
  return `€${n.toFixed(0)}`;
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
        value={formatEur(totalMarketValueEur)}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-base font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
