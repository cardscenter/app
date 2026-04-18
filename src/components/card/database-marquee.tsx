import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cardSlug } from "@/lib/tcgdex/slug";

export interface MarqueeCard {
  id: string;
  name: string;
  localId: string;
  setSlug: string;
  imageUrl: string | null;
  priceAvg: number | null;
}

interface Props {
  items: MarqueeCard[];
}

/** Single card tile — small vertical card with image + price pill. */
function Tile({ card }: { card: MarqueeCard }) {
  return (
    <Link
      href={`/kaarten/${card.setSlug}/${cardSlug(card.name, card.localId)}`}
      className="group relative block shrink-0"
    >
      <div className="relative aspect-[5/7] w-[160px] overflow-hidden rounded-xl bg-muted shadow-md transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
        {card.imageUrl && (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            className="object-cover"
            sizes="160px"
            unoptimized
          />
        )}
      </div>
      {card.priceAvg != null && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-bold text-foreground shadow">
          €{card.priceAvg.toFixed(2)}
        </div>
      )}
    </Link>
  );
}

/** Horizontally scrolling row of cards — infinite marquee via CSS animation.
 *
 * The trick: render the items twice back-to-back and animate the track from
 * translateX(0) to translateX(-50%). When the second copy reaches where
 * the first started, the animation loops seamlessly.
 */
export function DatabaseMarquee({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden py-4"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 64px, black calc(100% - 64px), transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 64px, black calc(100% - 64px), transparent)",
      }}
    >
      <div className="marquee-track flex gap-4">
        {[...items, ...items].map((c, i) => (
          <Tile key={`${c.id}-${i}`} card={c} />
        ))}
      </div>
    </div>
  );
}
