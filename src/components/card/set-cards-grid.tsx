"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cardSlug } from "@/lib/tcgdex/slug";
import { getCardImageUrl } from "@/lib/tcgdex/card-image";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SetCard {
  id: string;
  name: string;
  localId: string;
  rarity: string | null;
  imageUrl: string | null;
  imageUrlFull: string | null;
  priceAvg: number | null;
  priceReverseAvg: number | null;
}

type Sort = "localAsc" | "localDesc" | "priceDesc" | "priceAsc";

const SORT_LABELS: Record<Sort, string> = {
  localAsc: "Collectienummer (oplopend)",
  localDesc: "Collectienummer (aflopend)",
  priceDesc: "Marktprijs (hoog → laag)",
  priceAsc: "Marktprijs (laag → hoog)",
};

function naturalCompare(a: string, b: string): number {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}

const FOIL_RE = /\b(holo|hyper|ultra|full art|illustration|special|double|amazing|radiant|shiny|secret|rainbow)\b/i;

function isFoilRarity(rarity: string | null): boolean {
  return FOIL_RE.test(rarity ?? "");
}

/** Best-effort "market price" — use reverse-holo price if the normal field
 * is suspiciously low (inherently-foil noise), otherwise the normal. */
function effectivePrice(c: SetCard): number | null {
  if (isFoilRarity(c.rarity) && c.priceReverseAvg !== null) return c.priceReverseAvg;
  return c.priceAvg;
}

interface Props {
  cards: SetCard[];
  setSlug: string;
}

export function SetCardsGrid({ cards, setSlug }: Props) {
  const [sort, setSort] = useState<Sort>("localAsc");
  const [menuOpen, setMenuOpen] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...cards];
    if (sort === "localAsc") arr.sort((a, b) => naturalCompare(a.localId, b.localId));
    else if (sort === "localDesc") arr.sort((a, b) => naturalCompare(b.localId, a.localId));
    else if (sort === "priceDesc" || sort === "priceAsc") {
      arr.sort((a, b) => {
        const pa = effectivePrice(a);
        const pb = effectivePrice(b);
        const aNull = pa === null;
        const bNull = pb === null;
        if (aNull && bNull) return naturalCompare(a.localId, b.localId);
        if (aNull) return 1;   // null prices sink to bottom regardless of direction
        if (bNull) return -1;
        return sort === "priceDesc" ? pb! - pa! : pa! - pb!;
      });
    }
    return arr;
  }, [cards, sort]);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/40"
          >
            Sorteren: <span className="text-muted-foreground">{SORT_LABELS[sort]}</span>
            <ChevronDown className={cn("size-4 transition-transform", menuOpen && "rotate-180")} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              {(Object.keys(SORT_LABELS) as Sort[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSort(key); setMenuOpen(false); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                    sort === key && "bg-primary/10 font-semibold text-primary"
                  )}
                >
                  {SORT_LABELS[key]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {sorted.map((card) => {
          const imgSrc = getCardImageUrl(card, "low");
          const price = effectivePrice(card);
          return (
            <Link
              key={card.id}
              href={`/kaarten/${setSlug}/${cardSlug(card.name, card.localId)}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:scale-[1.02] hover:shadow-lg"
            >
              <div className="relative aspect-[5/7] bg-muted">
                {imgSrc ? (
                  <Image
                    src={imgSrc}
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
              <div className="space-y-1 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{card.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      #{card.localId}
                      {card.rarity && card.rarity !== "None" && ` · ${card.rarity}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  {price !== null && (
                    <span className="text-[10px] font-bold text-foreground tabular-nums">
                      €{price.toFixed(2)}
                    </span>
                  )}
                  {card.priceReverseAvg !== null && !isFoilRarity(card.rarity) && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-purple-600 dark:text-purple-400">
                      <span className="font-medium">Reverse</span> €{card.priceReverseAvg.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
