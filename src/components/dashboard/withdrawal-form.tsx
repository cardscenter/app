"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestWithdrawal } from "@/actions/withdrawal";

interface WithdrawalFormProps {
  available: number;
  minAmount: number;
  disabled: boolean;
  disabledReason: string | null;
}

export function WithdrawalForm({ available, minAmount, disabled, disabledReason }: WithdrawalFormProps) {
  const t = useTranslations("withdrawal");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const value = parseFloat(amount) || 0;
  const isValid = value >= minAmount && value <= available;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("amount", amount);

    startTransition(async () => {
      const result = await requestWithdrawal(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(t("requestSubmitted"));
      setAmount("");
      router.refresh();
    });
  }

  if (disabled) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        {disabledReason}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-foreground">
          {t("amountLabel")}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">€</span>
          <input
            id="amount"
            type="number"
            step="0.01"
            min={minAmount}
            max={available}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="block w-48 glass-input px-3 py-2.5 text-foreground"
            required
          />
          <button
            type="button"
            onClick={() => setAmount(available.toFixed(2))}
            className="text-xs text-primary hover:underline"
          >
            {t("max")}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("minAmountHint", { min: minAmount.toFixed(2) })}
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={!isValid || pending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "..." : t("requestButton")}
      </button>
    </form>
  );
}
