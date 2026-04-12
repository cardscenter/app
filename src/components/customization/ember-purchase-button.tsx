"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { EmberIcon } from "@/components/customization/ember-icon";
import { purchaseEmber } from "@/actions/customization";
import { EMBER_CONFIG } from "@/lib/cosmetic-config";
import { cn } from "@/lib/utils";
import { X, Sparkles, AlertTriangle } from "lucide-react";

const PACKAGES = [
  { amount: 100,  bonus: 0,  label: "100" },
  { amount: 250,  bonus: 0,  label: "250" },
  { amount: 500,  bonus: 5,  label: "500" },
  { amount: 1000, bonus: 10, label: "1.000" },
  { amount: 2500, bonus: 15, label: "2.500" },
  { amount: 5000, bonus: 20, label: "5.000" },
];

type Step = "select" | "confirm";

export function EmberPurchaseButton({ accountType = "FREE" }: { accountType?: string }) {
  const t = useTranslations("customization");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // FREE accounts cannot see the purchase option
  if (accountType === "FREE") return null;
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState(2); // default 500
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pkg = PACKAGES[selected];
  const bonusAmount = Math.floor(pkg.amount * (pkg.bonus / 100));
  const totalEmber = pkg.amount + bonusAmount;
  const eurCost = pkg.amount / EMBER_CONFIG.eurToEmber;

  function handleClose() {
    setIsOpen(false);
    setStep("select");
    setError(null);
  }

  function handlePurchase() {
    setError(null);
    startTransition(async () => {
      const result = await purchaseEmber(pkg.amount);
      if (result.error) {
        setError(result.error);
        setStep("select");
      } else {
        handleClose();
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40 hover:brightness-110"
      >
        <EmberIcon className="size-4" />
        {t("buyEmber")}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
          <div
            className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <EmberIcon className="size-6" />
                <h3 className="text-xl font-bold text-white">{t("buyEmber")}</h3>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            {step === "select" ? (
              <div className="p-6">
                <p className="mb-4 text-sm text-slate-400">{t("buyEmberDesc")}</p>

                {/* Package grid */}
                <div className="grid grid-cols-2 gap-3">
                  {PACKAGES.map((p, i) => {
                    const pBonus = Math.floor(p.amount * (p.bonus / 100));
                    const pTotal = p.amount + pBonus;
                    const isSelected = selected === i;

                    return (
                      <button
                        key={p.amount}
                        onClick={() => setSelected(i)}
                        className={cn(
                          "relative overflow-hidden rounded-xl p-4 text-left transition-all",
                          isSelected
                            ? "bg-orange-500/15 ring-2 ring-orange-400"
                            : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20"
                        )}
                      >
                        {p.bonus > 0 && (
                          <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                            <Sparkles className="size-3" />
                            +{p.bonus}%
                          </div>
                        )}

                        {/* Total Ember you get */}
                        <div className="flex items-center gap-1.5">
                          <EmberIcon className="size-5" />
                          <span className="text-lg font-bold text-white">{pTotal.toLocaleString("nl-NL")}</span>
                        </div>

                        {/* Breakdown: base + bonus */}
                        {pBonus > 0 ? (
                          <p className="mt-1 text-xs text-slate-400">
                            {p.label} + <span className="text-emerald-400">{pBonus} gratis</span>
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-400">{p.label} Ember</p>
                        )}

                        {/* EUR price */}
                        <p className="mt-2 text-sm font-semibold text-orange-400">
                          €{(p.amount / EMBER_CONFIG.eurToEmber).toFixed(2)}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {error && (
                  <p className="mt-4 text-center text-sm text-red-400">{error}</p>
                )}

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 ring-1 ring-white/10 transition-all hover:bg-white/5"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={() => setStep("confirm")}
                    className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40 hover:brightness-110"
                  >
                    {t("purchase")}
                  </button>
                </div>
              </div>
            ) : (
              /* Confirmation step */
              <div className="p-6">
                <div className="mb-6 flex flex-col items-center text-center">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-orange-500/15 ring-1 ring-orange-500/30">
                    <AlertTriangle className="size-7 text-orange-400" />
                  </div>
                  <h4 className="text-lg font-bold text-white">{t("confirmPurchaseTitle")}</h4>
                  <p className="mt-1 text-sm text-slate-400">{t("confirmPurchaseDesc")}</p>
                </div>

                <div className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{t("youReceive")}</span>
                    <div className="flex items-center gap-1.5">
                      <EmberIcon className="size-5" />
                      <span className="text-lg font-bold text-white">{totalEmber.toLocaleString("nl-NL")} Ember</span>
                    </div>
                  </div>
                  {bonusAmount > 0 && (
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{t("includingBonus")}</span>
                      <span className="text-xs text-emerald-400">+{bonusAmount.toLocaleString("nl-NL")} gratis</span>
                    </div>
                  )}
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{t("deductedFromBalance")}</span>
                      <span className="text-lg font-bold text-red-400">-€{eurCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="mt-4 text-center text-sm text-red-400">{error}</p>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setStep("select")}
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 ring-1 ring-white/10 transition-all hover:bg-white/5"
                  >
                    {t("goBack")}
                  </button>
                  <button
                    onClick={handlePurchase}
                    disabled={isPending}
                    className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40 hover:brightness-110 disabled:opacity-50"
                  >
                    {isPending ? "..." : t("confirmPurchase")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
