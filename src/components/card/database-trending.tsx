import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cardSlug } from "@/lib/tcgdex/slug";

export interface TrendingCard {
  id: string;
  name: string;
  localId: string;
  setName: string;
  setSlug: string;
  imageUrl: string | null;
  priceAvg: number;
  priceAvg7: number;
  deltaPct: number; // Pre-computed: (priceAvg - priceAvg7) / priceAvg7 * 100
}

interface Props {
  risers: TrendingCard[];
  fallers: TrendingCard[];
}

// Tiered rank badge — gold/silver/bronze for the top 3, muted grey for the rest.
function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 ring-1 ring-amber-600/40 shadow-sm"
      : rank === 2
      ? "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 ring-1 ring-slate-400/60 shadow-sm"
      : rank === 3
      ? "bg-gradient-to-br from-orange-400 to-amber-700 text-amber-50 ring-1 ring-amber-700/40 shadow-sm"
      : "bg-muted text-muted-foreground ring-1 ring-border";
  return (
    <span
      className={`absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${styles}`}
    >
      {rank}
    </span>
  );
}

function TrendTile({ card, direction, rank }: { card: TrendingCard; direction: "up" | "down"; rank: number }) {
  const isUp = direction === "up";
  const deltaColor = isUp
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
  return (
    <Link
      href={`/kaarten/${card.setSlug}/${cardSlug(card.name, card.localId)}`}
      className="relative flex items-center gap-2.5 rounded-xl border border-border bg-card p-2 transition-colors hover:bg-muted/40"
    >
      <RankBadge rank={rank} />
      <div className="relative aspect-[5/7] w-16 shrink-0 overflow-hidden rounded-md bg-muted sm:w-20">
        {card.imageUrl && (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            className="object-cover"
            sizes="80px"
            unoptimized
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">{card.name}</p>
        <p className="truncate text-[10px] leading-tight text-muted-foreground">{card.setName}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold leading-tight text-foreground tabular-nums">
          €{card.priceAvg.toFixed(2)}
        </p>
        <p className={`text-[11px] font-semibold leading-tight tabular-nums ${deltaColor}`}>
          {isUp ? "+" : ""}{card.deltaPct.toFixed(1)}%
        </p>
      </div>
    </Link>
  );
}

export function DatabaseTrending({ risers, fallers }: Props) {
  if (risers.length === 0 && fallers.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {risers.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <TrendingUp className="size-4 text-emerald-500" />
            Stijgers deze week
          </h3>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {risers.map((c, i) => <TrendTile key={c.id} card={c} direction="up" rank={i + 1} />)}
          </div>
        </div>
      )}
      {fallers.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <TrendingDown className="size-4 text-red-500" />
            Dalers deze week
          </h3>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {fallers.map((c, i) => <TrendTile key={c.id} card={c} direction="down" rank={i + 1} />)}
          </div>
        </div>
      )}
    </div>
  );
}
