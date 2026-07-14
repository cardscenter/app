import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { CardHit } from "@/lib/global-search";

/** Database-kaart-tegel voor de Kaarten-tab op /zoeken (patroon van
 *  pokedex-cards-grid: aspect-[5/7] thumb + naam + set · #nr + Marktprijs). */
export function CardResultTile({ card }: { card: CardHit }) {
  return (
    <Link
      href={card.href}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:scale-[1.02] hover:shadow-lg"
    >
      <div className="relative aspect-[5/7] bg-muted">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            unoptimized
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground/50">
            Geen afbeelding
          </div>
        )}
      </div>
      <div className="space-y-1 p-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{card.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {card.setName} · #{card.localId}
          </p>
        </div>
        {card.price !== null && (
          <p className="text-sm font-bold text-foreground tabular-nums">
            €{card.price.toFixed(2)}
          </p>
        )}
      </div>
    </Link>
  );
}
