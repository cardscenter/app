import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cardSlug } from "@/lib/card-helpers";
import { DataCard } from "@/components/ploy/data-card";

export interface TrendingCard {
  id: string;
  name: string;
  localId: string;
  setName: string;
  setSlug: string;
  imageUrl: string | null;
  priceAvg: number;
  priceAvg7: number;
  deltaPct: number; // Pre-computed: begin→eind van de 30-dagen-trendfit (fallback: snapshot-delta)
}

interface Props {
  risers: TrendingCard[];
  fallers: TrendingCard[];
}

/** Rij in de stijgers-/dalerslijst: rang in de display-letter, thumbnail, naam, prijs en delta. */
function TrendRow({ card, direction, rank }: { card: TrendingCard; direction: "up" | "down"; rank: number }) {
  const isUp = direction === "up";
  return (
    <Link href={`/kaarten/${card.setSlug}/${cardSlug(card.name, card.localId)}`} className="flex items-center gap-3 rounded-[10px] px-2 py-2 no-underline transition-colors hover:bg-[var(--background)]">
      <span className={`cc-display w-8 shrink-0 text-2xl leading-none ${rank <= 3 ? "text-[var(--primary)]" : "text-[var(--foreground)]/40"}`}>{String(rank).padStart(2, "0")}</span>
      <div className="relative aspect-[5/7] w-11 shrink-0 overflow-hidden rounded-[6px] bg-[var(--muted)]">
        {card.imageUrl && <Image src={card.imageUrl} alt={card.name} fill className="object-cover" sizes="44px" unoptimized />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-[var(--foreground)]">{card.name}</p>
        <p className="truncate text-[11px] leading-tight text-[var(--foreground)]/55">{card.setName}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold leading-tight tabular-nums text-[var(--foreground)]">€{card.priceAvg.toFixed(2)}</p>
        <p className={`cc-pill mt-0.5 inline-block px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums ${isUp ? "bg-[var(--pastel-green)] text-[var(--foreground)]" : "bg-[var(--pastel-pink)] text-[var(--foreground)]"}`}>
          {isUp ? "+" : ""}
          {card.deltaPct.toFixed(1)}%
        </p>
      </div>
    </Link>
  );
}

/** Stijgers en dalers van de afgelopen maand als twee datakaarten (design-pass). */
export function DatabaseTrending({ risers, fallers }: Props) {
  if (risers.length === 0 && fallers.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {risers.length > 0 && (
        <DataCard badge="Stijgers" badgeColor="green" title="Afgelopen maand">
          <div className="-mx-2 divide-y divide-[var(--border)]">
            {risers.map((c, i) => (
              <TrendRow key={c.id} card={c} direction="up" rank={i + 1} />
            ))}
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--foreground)]/55">
            <TrendingUp className="size-3.5" /> Op basis van de 30-dagen-trendlijn van de marktprijs.
          </p>
        </DataCard>
      )}
      {fallers.length > 0 && (
        <DataCard badge="Dalers" badgeColor="pink" title="Afgelopen maand">
          <div className="-mx-2 divide-y divide-[var(--border)]">
            {fallers.map((c, i) => (
              <TrendRow key={c.id} card={c} direction="down" rank={i + 1} />
            ))}
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--foreground)]/55">
            <TrendingDown className="size-3.5" /> Op basis van de 30-dagen-trendlijn van de marktprijs.
          </p>
        </DataCard>
      )}
    </div>
  );
}
