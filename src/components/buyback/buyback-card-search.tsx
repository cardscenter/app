"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Search, Plus, Minus, Loader2 } from "lucide-react";
import Image from "next/image";
import {
  getAvailableVariants,
  getBuybackPrice,
  checkBuybackEligibility,
  type BuybackPriceFields,
} from "@/lib/buyback-pricing";

interface SearchResult extends BuybackPriceFields {
  id: string;
  name: string;
  localId: string;
  setName: string;
  setSlug: string;
  imageUrl: string | null;
  releaseDate: string | null;
}

export const CARD_CONDITIONS = ["NEAR_MINT", "EXCELLENT", "GOOD", "LIGHT_PLAYED", "PLAYED", "POOR"] as const;
export type CardConditionKey = (typeof CARD_CONDITIONS)[number];

export const CONDITION_LABELS: Record<CardConditionKey, string> = {
  NEAR_MINT: "Near Mint",
  EXCELLENT: "Excellent",
  GOOD: "Good",
  LIGHT_PLAYED: "Light Played",
  PLAYED: "Played",
  POOR: "Poor",
};

export interface SelectedCard {
  cardId: string;
  name: string;
  localId: string;
  setName: string;
  rarity: string | null;
  imageUrl: string | null;
  marketPrice: number;
  buybackPrice: number;
  isReverse: boolean;
  quantity: number;
  variantLabel: string;
  condition: CardConditionKey;
}

interface BuybackCardSearchProps {
  onAdd: (card: SelectedCard) => void;
  selectedKeys: Set<string>;
}

/** Unique key per card+variant so you can add normal AND reverse of the same card */
export function cardVariantKey(cardId: string, isReverse: boolean): string {
  return `${cardId}__${isReverse ? "rev" : "std"}`;
}

export function BuybackCardSearch({ onAdd, selectedKeys }: BuybackCardSearchProps) {
  const t = useTranslations("buyback");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}&limit=50`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleAdd(card: SearchResult, variant: { price: number; isReverse: boolean; label: string }) {
    const key = cardVariantKey(card.id, variant.isReverse);
    const qty = quantities[key] || 1;
    onAdd({
      cardId: card.id,
      name: card.name,
      localId: card.localId,
      setName: card.setName,
      rarity: card.rarity,
      imageUrl: card.imageUrl,
      marketPrice: variant.price,
      buybackPrice: getBuybackPrice(variant.price),
      isReverse: variant.isReverse,
      quantity: qty,
      variantLabel: variant.label,
      condition: "NEAR_MINT",
    });
    setQuantities((prev) => ({ ...prev, [key]: 1 }));
  }

  function updateQty(key: string, delta: number) {
    setQuantities((prev) => ({
      ...prev,
      [key]: Math.max(1, Math.min(100, (prev[key] || 1) + delta)),
    }));
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="max-h-[500px] space-y-1 overflow-y-auto rounded-xl border border-input p-2">
          {results.map((card) => {
            const variants = getAvailableVariants(card);
            if (variants.length === 0) {
              // No price — show disabled
              return (
                <div key={card.id} className="flex items-center gap-3 rounded-lg p-2 opacity-40">
                  <CardImage card={card} />
                  <CardInfo card={card} />
                  <p className="text-xs text-muted-foreground">{t("noPriceAvailable")}</p>
                </div>
              );
            }

            // Per-variant eligibility — price cap per variant, era-cutoff on set
            const variantsWithEligibility = variants.map((v) => ({
              variant: v,
              eligibility: checkBuybackEligibility(v.price, card.releaseDate),
            }));
            const allIneligible = variantsWithEligibility.every((v) => !v.eligibility.eligible);

            return (
              <div
                key={card.id}
                className={`flex gap-3 rounded-lg p-2 ${allIneligible ? "" : "hover:bg-muted/50"}`}
              >
                {/* Image left */}
                <CardImage card={card} />

                {/* Everything else right */}
                <div className="min-w-0 flex-1">
                  <CardInfo card={card} />

                  {/* Variant rows */}
                  <div className="mt-1.5 space-y-1">
                    {variantsWithEligibility.map(({ variant, eligibility }) => {
                      const key = cardVariantKey(card.id, variant.isReverse);
                      const alreadyAdded = selectedKeys.has(key);
                      const buyback = getBuybackPrice(variant.price);
                      const blocked = !eligibility.eligible;

                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                            alreadyAdded || blocked ? "opacity-50" : "hover:bg-muted/30"
                          }`}
                        >
                          {/* Variant label */}
                          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            variant.isReverse
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}>
                            {variant.label}
                          </span>

                          {/* Pricing (also shown for blocked so user sees why) */}
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground">
                              €{variant.price.toFixed(2)}
                            </span>
                            {!blocked && (
                              <>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-semibold text-emerald-600">
                                  €{buyback.toFixed(2)}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="ml-auto" />

                          {blocked && (
                            <span className="shrink-0 text-right text-[11px] italic text-muted-foreground">
                              {t("notEligible")}
                            </span>
                          )}

                          {/* Quantity + Add */}
                          {!alreadyAdded && !blocked && (
                            <div className="flex shrink-0 items-center gap-1">
                              <button type="button" onClick={() => updateQty(key, -1)} className="rounded p-1 hover:bg-muted">
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-xs">{quantities[key] || 1}</span>
                              <button type="button" onClick={() => updateQty(key, 1)} className="rounded p-1 hover:bg-muted">
                                <Plus className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdd(card, variant)}
                                className="ml-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90"
                              >
                                {t("addCard")}
                              </button>
                            </div>
                          )}
                          {alreadyAdded && !blocked && (
                            <span className="text-xs text-muted-foreground">&#10003;</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardImage({ card }: { card: SearchResult }) {
  const [hover, setHover] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function handleEnter() {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.right + 12 });
    }
    setHover(true);
  }

  return (
    <div
      ref={imgRef}
      className="h-[130px] w-[93px] shrink-0"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHover(false)}
    >
      <div className="h-full w-full overflow-hidden rounded">
        {card.imageUrl ? (
          <Image src={card.imageUrl} alt={card.name} width={93} height={130} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-xs">?</div>
        )}
      </div>
      {/* Enlarged preview on hover (desktop only, fixed so it escapes overflow containers) */}
      {hover && card.imageUrl && (
        <div
          className="pointer-events-none fixed z-[100] hidden md:block"
          style={{ top: pos.top, left: pos.left }}
        >
          <Image
            src={card.imageUrl.replace("/low.", "/high.")}
            alt={card.name}
            width={320}
            height={448}
            className="rounded-lg shadow-2xl ring-1 ring-black/10"
            unoptimized
          />
        </div>
      )}
    </div>
  );
}

function CardInfo({ card }: { card: SearchResult }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{card.name}</p>
      <p className="truncate text-xs text-muted-foreground">{card.setName} · #{card.localId}</p>
    </div>
  );
}
