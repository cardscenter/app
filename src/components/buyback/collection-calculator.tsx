"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckSquare, Package } from "lucide-react";
import { BuybackCardSearch, cardVariantKey, type SelectedCard, type CardConditionKey } from "./buyback-card-search";
import { BuybackCart } from "./buyback-cart";
import { PayoutMethodSelect } from "./payout-method-select";
import { BuybackSuccess } from "./buyback-success";
import { submitCollectionBuyback } from "@/actions/buyback";
import { MINIMUM_COLLECTION_VALUE, getStoreCreditBonus } from "@/lib/buyback-pricing";
import type { PayoutMethod } from "@/types";

export function CollectionCalculator() {
  const t = useTranslations("buyback");
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Card selection state — keyed by cardId+variant
  const [items, setItems] = useState<SelectedCard[]>([]);

  // Payout state
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("BANK");
  const [iban, setIban] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  // Confirmation checkboxes
  const [confirmNM, setConfirmNM] = useState(false);
  const [confirmCenter, setConfirmCenter] = useState(false);
  const [confirmTerms, setConfirmTerms] = useState(false);

  // Success state
  const [successId, setSuccessId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [actionState, formAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await submitCollectionBuyback(formData);
      return result ?? null;
    },
    null
  );

  // Bij elke stap-overgang naar boven scrollen — anders blijft de viewport
  // op de oude positie (storend op mobile + lange step 1-pagina).
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

  useEffect(() => {
    if (actionState?.success && actionState.requestId) {
      setSuccessId(actionState.requestId);
      setStep(3);
      toast.success(t("successTitle"));
    } else if (actionState?.error) {
      toast.error(actionState.error);
    }
  }, [actionState, t]);

  // Only Near Mint cards count toward the total — other conditions are not bought
  const acceptedItems = items.filter((i) => i.condition === "NEAR_MINT");
  const hasRejectedCards = items.some((i) => i.condition !== "NEAR_MINT");
  const total = acceptedItems.reduce((sum, i) => sum + i.buybackPrice * i.quantity, 0);
  const roundedTotal = Math.round(total * 100) / 100;
  const minimumMet = roundedTotal >= MINIMUM_COLLECTION_VALUE;
  const bonusAmount = getStoreCreditBonus(roundedTotal);

  // Track selected card+variant combos
  const selectedKeys = new Set(items.map((i) => cardVariantKey(i.cardId, i.isReverse)));

  function handleAddCard(card: SelectedCard) {
    const key = cardVariantKey(card.cardId, card.isReverse);
    setItems((prev) => {
      const existing = prev.find(
        (i) => cardVariantKey(i.cardId, i.isReverse) === key
      );
      if (existing) {
        // Bestaand item bovenaan plaatsen + aantal verhogen, zodat de
        // verkoper meteen ziet dat het toegevoegd is.
        const updated = { ...existing, quantity: existing.quantity + card.quantity };
        const rest = prev.filter((i) => cardVariantKey(i.cardId, i.isReverse) !== key);
        return [updated, ...rest];
      }
      // Nieuw item bovenaan toevoegen — meest recente staat altijd in beeld.
      return [card, ...prev];
    });
  }

  function handleUpdateQuantity(key: string, quantity: number) {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => cardVariantKey(i.cardId, i.isReverse) !== key));
    } else {
      setItems((prev) =>
        prev.map((i) =>
          cardVariantKey(i.cardId, i.isReverse) === key
            ? { ...i, quantity: Math.min(100, quantity) }
            : i
        )
      );
    }
  }

  function handleRemove(key: string) {
    setItems((prev) => prev.filter((i) => cardVariantKey(i.cardId, i.isReverse) !== key));
  }

  function handleUpdateCondition(key: string, condition: CardConditionKey) {
    setItems((prev) =>
      prev.map((i) =>
        cardVariantKey(i.cardId, i.isReverse) === key ? { ...i, condition } : i
      )
    );
  }

  function handleSubmit() {
    const formData = new FormData();
    formData.set(
      "items",
      JSON.stringify(
        acceptedItems.map((i) => ({
          cardId: i.cardId,
          quantity: i.quantity,
          isReverse: i.isReverse,
        }))
      )
    );
    formData.set("payoutMethod", payoutMethod);
    if (payoutMethod === "BANK") {
      formData.set("iban", iban);
      formData.set("accountHolder", accountHolder);
    }
    formData.set("confirmNearMint", String(confirmNM));
    formData.set("confirmNotOffCenter", String(confirmCenter));

    startTransition(() => formAction(formData));
  }

  // Step 3: Success
  if (step === 3 && successId) {
    return <BuybackSuccess requestId={successId} />;
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Search + select */}
      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <BuybackCardSearch onAdd={handleAddCard} selectedKeys={selectedKeys} />
          </div>
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-4">
              <BuybackCart
                items={items}
                onUpdateQuantity={handleUpdateQuantity}
                onUpdateCondition={handleUpdateCondition}
                onRemove={handleRemove}
                total={roundedTotal}
                minimumMet={minimumMet}
              />
              {items.length > 0 && minimumMet && !hasRejectedCards && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  {t("nextStep")} <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {hasRejectedCards && (
                <p className="mt-3 text-center text-xs text-amber-600 dark:text-amber-400">
                  Verwijder eerst de niet-Near Mint kaarten om door te gaan
                </p>
              )}
              <Link
                href="/verkoop-calculator/bulk"
                className="mt-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 transition-colors hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    {t("bulkNoticeTitle")}
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    {t("bulkNoticeDesc")}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-800 dark:text-amber-300" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Confirmation */}
      {step === 2 && (
        <div className="mx-auto max-w-2xl space-y-6">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {t("previousStep")}
          </button>

          <h2 className="text-xl font-bold">{t("confirmation")}</h2>

          <BuybackCart
            items={items}
            onUpdateQuantity={handleUpdateQuantity}
            onUpdateCondition={handleUpdateCondition}
            onRemove={handleRemove}
            total={roundedTotal}
            minimumMet={minimumMet}
          />

          <PayoutMethodSelect
            value={payoutMethod}
            onChange={setPayoutMethod}
            iban={iban}
            onIbanChange={setIban}
            accountHolder={accountHolder}
            onAccountHolderChange={setAccountHolder}
            estimatedPayout={roundedTotal}
            bonusAmount={bonusAmount}
          />

          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmNM}
                onChange={(e) => setConfirmNM(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>{t("confirmNearMint")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmCenter}
                onChange={(e) => setConfirmCenter(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>{t("confirmNotOffCenter")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmTerms}
                onChange={(e) => setConfirmTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>
                {t("confirmTermsPrefix")}{" "}
                <Link
                  href="/verkoop-calculator/voorwaarden-collectie"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {t("confirmTermsLinkLabel")}
                </Link>
                {t("confirmTermsSuffix")}
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isPending ||
              !confirmNM ||
              !confirmCenter ||
              !confirmTerms ||
              !minimumMet ||
              (payoutMethod === "BANK" && (!iban || !accountHolder))
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare className="h-4 w-4" />
            {isPending ? t("submitting") : t("submitRequest")}
          </button>

          {actionState?.error && (
            <p className="text-center text-sm text-red-500">{actionState.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
