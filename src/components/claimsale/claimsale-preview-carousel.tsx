"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PreviewCarouselItem {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  firstImage: string;
}

interface Props {
  items: PreviewCarouselItem[];
  claimsaleId: string;
  locale: string;
}

/**
 * Geavanceerde Kaart-Preview-Rij (betaalde upsell): 2-rijs carousel met tot
 * 50 kaart-thumbnails. Desktop: pijltjes scrollen een pagina-breedte;
 * mobile: native horizontaal scrollen.
 */
export function ClaimsalePreviewCarousel({ items, claimsaleId, locale }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <div className="group/carousel relative mt-3">
      <div
        ref={scrollRef}
        className="grid grid-flow-col grid-rows-2 auto-cols-max gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/${locale}/claimsales/${claimsaleId}`}
            className="group/thumb flex w-20 shrink-0 flex-col gap-1"
            title={`${item.cardName} · ${item.condition} · €${item.price.toFixed(2)}`}
          >
            <div className="relative h-28 w-20 overflow-hidden rounded-sm bg-muted ring-1 ring-border transition-transform group-hover/thumb:scale-[1.04]">
              <Image
                src={item.firstImage}
                alt={item.cardName}
                fill
                className="object-cover"
                sizes="160px"
                quality={85}
              />
            </div>
            <span className="text-center text-[11px] font-semibold text-foreground tabular-nums">
              €{item.price.toFixed(2)}
            </span>
          </Link>
        ))}
      </div>

      {/* Desktop-pijltjes — verschijnen on-hover, alleen relevant bij meer dan
          een paar kolommen (anders is er niets te scrollen). */}
      {items.length > 8 && (
        <>
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Vorige"
            className="absolute left-0 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/90 p-1.5 text-foreground shadow-md ring-1 ring-border transition-opacity hover:bg-background sm:block sm:opacity-0 group-hover/carousel:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Volgende"
            className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/90 p-1.5 text-foreground shadow-md ring-1 ring-border transition-opacity hover:bg-background sm:block sm:opacity-0 group-hover/carousel:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
