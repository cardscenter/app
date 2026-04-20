"use client";

import { useRef } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cardSlug } from "@/lib/card-helpers";

export interface CarouselCard {
  id: string;
  name: string;
  localId: string;
  rarity: string | null;
  setName: string;
  setSlug: string;     // tcgdexSetId
  imageUrl: string | null;   // rendered URL (already resolved via getCardImageUrl)
}

interface Props {
  title: string;
  items: CarouselCard[];
}

export function CardCarousel({ title, items }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  if (items.length === 0) return null;

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Vorige"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Volgende"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]"
      >
        {items.map((c) => (
          <Link
            key={c.id}
            href={`/kaarten/${c.setSlug}/${cardSlug(c.name, c.localId)}`}
            className="group flex w-36 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:scale-[1.03] hover:shadow-lg sm:w-40"
          >
            <div className="relative aspect-[5/7] bg-muted">
              {c.imageUrl ? (
                <Image
                  src={c.imageUrl}
                  alt={c.name}
                  fill
                  className="object-cover"
                  sizes="160px"
                  unoptimized
                />
              ) : (
                <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground/50">
                  Geen<br />afb.
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-semibold text-foreground">{c.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {c.setName} · #{c.localId}
              </p>
              {c.rarity && c.rarity !== "None" && (
                <p className="truncate text-[10px] text-muted-foreground italic">{c.rarity}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
