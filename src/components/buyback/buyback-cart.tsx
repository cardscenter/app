"use client";

import { useTranslations } from "next-intl";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { cardVariantKey, type SelectedCard } from "./buyback-card-search";

interface BuybackCartProps {
  items: SelectedCard[];
  onUpdateQuantity: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  total: number;
  minimumMet: boolean;
}

export function BuybackCart({ items, onUpdateQuantity, onRemove, total, minimumMet }: BuybackCartProps) {
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

      <div className="max-h-[400px] divide-y divide-border/30 overflow-y-auto">
        {items.map((item) => {
          const key = cardVariantKey(item.cardId, item.isReverse);
          return (
            <div key={key} className="flex items-center gap-3 p-3">
              {/* Image */}
              <div className="h-[72px] w-[51px] shrink-0 overflow-hidden rounded">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    width={44}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-[8px]">?</div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs text-muted-foreground">
                    {item.setName} · €{item.buybackPrice.toFixed(2)}/st
                  </span>
                  <span className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                    item.isReverse
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}>
                    {item.variantLabel}
                  </span>
                </div>
              </div>

              {/* Quantity controls */}
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
              </div>

              {/* Subtotal */}
              <p className="w-16 text-right text-sm font-medium">
                €{(item.buybackPrice * item.quantity).toFixed(2)}
              </p>

              {/* Remove */}
              <button
                type="button"
                onClick={() => onRemove(key)}
                className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
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
