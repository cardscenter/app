"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Plus, Minus, ShoppingBag, AlertTriangle } from "lucide-react";
import Image from "next/image";
import {
  cardVariantKey,
  CARD_CONDITIONS,
  CONDITION_LABELS,
  type CardConditionKey,
  type SelectedCard,
} from "./buyback-card-search";

interface BuybackCartProps {
  items: SelectedCard[];
  onUpdateQuantity: (key: string, quantity: number) => void;
  onUpdateCondition: (key: string, condition: CardConditionKey) => void;
  onRemove: (key: string) => void;
  total: number;
  minimumMet: boolean;
}

export function BuybackCart({ items, onUpdateQuantity, onUpdateCondition, onRemove, total, minimumMet }: BuybackCartProps) {
  const t = useTranslations("buyback");

  if (items.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-xl p-8 text-center">
        <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("emptyCart")}</p>
      </div>
    );
  }

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="glass rounded-xl">
      <div className="border-b border-border/50 p-4">
        <h3 className="font-semibold">{t("yourSelection")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("totalItems")}: {totalItems}
        </p>
      </div>

      <div className="max-h-[600px] divide-y divide-border/30 overflow-y-auto">
        {items.map((item) => {
          const key = cardVariantKey(item.cardId, item.isReverse);
          const isNotAccepted = item.condition !== "NEAR_MINT";

          return (
            <div key={key} className="relative">
              <div className="flex items-start gap-3 p-3">
                {/* Image with hover preview */}
                <CartImage imageUrl={item.imageUrl} name={item.name} />

                {/* Info + variant label + condition */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.setName} · €{item.buybackPrice.toFixed(2)}/st
                  </p>
                  <span className={`inline-flex w-fit rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    item.isReverse
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}>
                    {item.variantLabel}
                  </span>
                  {/* Condition dropdown */}
                  <select
                    value={item.condition}
                    onChange={(e) => onUpdateCondition(key, e.target.value as CardConditionKey)}
                    className="block w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    {CARD_CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {CONDITION_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Right column: subtotal + quantity + remove */}
                <div className="flex flex-col items-end gap-2">
                  <p className="text-sm font-semibold">
                    €{(item.buybackPrice * item.quantity).toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(key, item.quantity - 1)}
                      className="rounded p-1 hover:bg-muted"
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(key, item.quantity + 1)}
                      className="rounded p-1 hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(key)}
                      className="ml-1 rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Overlay for non-NM cards */}
              {isNotAccepted && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded bg-background/95 p-4 text-center backdrop-blur-sm">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                  <p className="text-xs font-medium">
                    Wij kopen alleen Near Mint kaarten in
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Deze kaart kan momenteel niet verkocht worden
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemove(key)}
                    className="mt-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                  >
                    Verwijder deze kaart
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="border-t border-border/50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t("estimatedPayout")}</span>
          <span className="text-lg font-bold text-emerald-600">
            €{total.toFixed(2)}
          </span>
        </div>
        {!minimumMet && (
          <p className="mt-1 text-xs text-red-500">
            {t("minimumNotMetCollection")}
          </p>
        )}
      </div>
    </div>
  );
}

function CartImage({ imageUrl, name }: { imageUrl: string | null; name: string }) {
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
      className="h-[100px] w-[71px] shrink-0"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHover(false)}
    >
      <div className="h-full w-full overflow-hidden rounded">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={71} height={100} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-[8px]">?</div>
        )}
      </div>
      {hover && imageUrl && (
        <div
          className="pointer-events-none fixed z-[100] hidden md:block"
          style={{ top: pos.top, left: pos.left }}
        >
          <Image
            src={imageUrl.replace("/low.", "/high.")}
            alt={name}
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
