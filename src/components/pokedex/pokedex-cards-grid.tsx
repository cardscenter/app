"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cardSlug } from "@/lib/card-helpers";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PokedexCard {
  id: string;
  name: string;
  localId: string;
  rarity: string | null;
  imageUrl: string | null; // pre-resolved via getCardImageUrl (server)
  setName: string;
  setSlug: string;
  releaseDate: string | null;
  /** Pre-computed outlier-resistant Marktprijs (server-side). */
  marktprijs: number | null;
  /** Pre-computed reverse-holo Marktprijs (incl. TP-fallback). */
  marktprijsRH: number | null;
}

type Sort = "newest" | "oldest" | "priceDesc" | "priceAsc";

const SORT_LABELS: Record<Sort, string> = {
  newest: "Nieuwste set eerst",
  oldest: "Oudste set eerst",
  priceDesc: "Marktprijs (hoog → laag)",
  priceAsc: "Marktprijs (laag → hoog)",
};

const FOIL_RE = /\b(holo|hyper|ultra|full art|illustration|special|double|amazing|radiant|shiny|secret|rainbow)\b/i;

function isFoilRarity(rarity: string | null): boolean {
  return FOIL_RE.test(rarity ?? "");
}

/** Voor inherent-foil rarities is de holo-variant de echte waarde. */
function effectivePrice(c: PokedexCard): number | null {
  if (isFoilRarity(c.rarity) && c.marktprijsRH !== null) return c.marktprijsRH;
  return c.marktprijs;
}

function byRelease(a: PokedexCard, b: PokedexCard, dir: 1 | -1): number {
  const cmp = (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "");
  if (cmp !== 0) return cmp * dir;
  return a.localId.localeCompare(b.localId, undefined, { numeric: true });
}

interface Props {
  cards: PokedexCard[];
}

export function PokedexCardsGrid({ cards }: Props) {
  const [sort, setSort] = useState<Sort>("newest");
  const [menuOpen, setMenuOpen] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...cards];
    if (sort === "newest") arr.sort((a, b) => byRelease(a, b, -1));
    else if (sort === "oldest") arr.sort((a, b) => byRelease(a, b, 1));
    else {
      arr.sort((a, b) => {
        const pa = effectivePrice(a);
        const pb = effectivePrice(b);
        if (pa === null && pb === null) return byRelease(a, b, -1);
        if (pa === null) return 1; // null-prijzen zakken altijd naar beneden
        if (pb === null) return -1;
        return sort === "priceDesc" ? pb - pa : pa - pb;
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
            className="cc-pill inline-flex items-center gap-2 border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
          >
            Sorteren: <span className="text-muted-foreground">{SORT_LABELS[sort]}</span>
            <ChevronDown className={cn("size-4 transition-transform", menuOpen && "rotate-180")} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-[12px] border border-[var(--border)] bg-white shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)]">
              {(Object.keys(SORT_LABELS) as Sort[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSort(key); setMenuOpen(false); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--background)]",
                    sort === key && "bg-[var(--pastel-yellow)] font-semibold text-[var(--foreground)]"
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
          const price = effectivePrice(card);
          return (
            <Link
              key={card.id}
              href={`/kaarten/${card.setSlug}/${cardSlug(card.name, card.localId)}`}
              className="group flex flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_2px_8px_0_var(--cc-border-subtle)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)]"
            >
              <div className="relative aspect-[5/7] bg-[var(--muted)]">
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
                <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                  {price !== null && (
                    <span className="text-sm font-semibold text-[var(--foreground)] tabular-nums">
                      €{price.toFixed(2)}
                    </span>
                  )}
                  {card.marktprijsRH !== null && !isFoilRarity(card.rarity) && (
                    <span className="inline-flex items-center gap-0.5 text-xs tabular-nums text-[var(--pastel-blue-ink)]">
                      <span className="font-medium">Reverse</span> €{card.marktprijsRH.toFixed(2)}
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
