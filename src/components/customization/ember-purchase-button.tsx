"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { EmberIcon } from "@/components/customization/ember-icon";
import { purchaseEmber } from "@/actions/customization";
import { EMBER_CONFIG } from "@/lib/cosmetic-config";

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2500];

export function EmberPurchaseButton() {
  const t = useTranslations("customization");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const eurCost = amount / EMBER_CONFIG.eurToEmber;

  function handlePurchase() {
    setError(null);
    startTransition(async () => {
      const result = await purchaseEmber(amount);
      if (result.error) {
        setError(result.error);
      } else {
        setIsOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
      >
        <EmberIcon className="size-4" />
        {t("buyEmber")}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsOpen(false)}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-semibold">{t("buyEmber")}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{t("eurToEmber")}</p>

            <div className="mb-4 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    amount === a
                      ? "bg-orange-500 text-white"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {a} Ember
                </button>
              ))}
            </div>

            <div className="mb-4 rounded-md bg-muted p-3 text-center">
              <span className="text-2xl font-bold">{amount.toLocaleString("nl-NL")}</span>
              <span className="ml-1 text-sm text-muted-foreground">Ember</span>
              <p className="text-sm text-muted-foreground">= €{eurCost.toFixed(2)}</p>
            </div>

            {error && (
              <p className="mb-3 text-sm text-red-500">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {t("cancel" as never)}
              </button>
              <button
                onClick={handlePurchase}
                disabled={isPending}
                className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                {isPending ? "..." : t("purchase")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
