"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { updateBankDetails } from "@/actions/profile";
import { formatIbanForDisplay } from "@/lib/validations/iban";

interface BankDetailsFormProps {
  iban: string | null;
  accountHolderName: string | null;
  lastIbanChange: string | null;
  cooldownDays: number;
}

export function BankDetailsForm({ iban, accountHolderName, lastIbanChange, cooldownDays }: BankDetailsFormProps) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(iban === null);
  const [ibanInput, setIbanInput] = useState(iban ?? "");
  const [holderInput, setHolderInput] = useState(accountHolderName ?? "");
  const [error, setError] = useState<string | null>(null);

  const lastChangeDate = lastIbanChange ? new Date(lastIbanChange) : null;
  const daysSinceChange = lastChangeDate
    ? (Date.now() - lastChangeDate.getTime()) / (1000 * 60 * 60 * 24)
    : null;
  const cooldownActive = daysSinceChange !== null && daysSinceChange < cooldownDays;
  const daysRemaining = cooldownActive && daysSinceChange !== null ? Math.ceil(cooldownDays - daysSinceChange) : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("iban", ibanInput);
    formData.set("accountHolderName", holderInput);

    startTransition(async () => {
      const result = await updateBankDetails(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(t("bankSaved"));
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing && iban) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Landmark className="size-4" />
          <span className="text-sm font-medium">{t("bankDetailsTitle")}</span>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("ibanLabel")}</p>
          <p className="font-mono text-sm text-foreground">{formatIbanForDisplay(iban)}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("accountHolderLabel")}</p>
          <p className="text-sm text-foreground">{accountHolderName ?? "—"}</p>
        </div>

        {cooldownActive && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("ibanCooldown", { days: daysRemaining })}
          </p>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={cooldownActive}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("editBankDetails")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Landmark className="size-4" />
        <span className="text-sm font-medium">{t("bankDetailsTitle")}</span>
      </div>

      <p className="text-xs text-muted-foreground">{t("bankDetailsHelp")}</p>

      <div>
        <label htmlFor="iban" className="block text-sm font-medium text-foreground">
          {t("ibanLabel")}
        </label>
        <input
          id="iban"
          name="iban"
          type="text"
          value={ibanInput}
          onChange={(e) => setIbanInput(e.target.value)}
          placeholder="NL91 ABNA 0417 1643 00"
          className="mt-1 block w-full glass-input px-3 py-2.5 text-sm font-mono uppercase text-foreground"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>

      <div>
        <label htmlFor="accountHolderName" className="block text-sm font-medium text-foreground">
          {t("accountHolderLabel")}
        </label>
        <input
          id="accountHolderName"
          name="accountHolderName"
          type="text"
          value={holderInput}
          onChange={(e) => setHolderInput(e.target.value)}
          className="mt-1 block w-full glass-input px-3 py-2.5 text-sm text-foreground"
          autoComplete="off"
          required
        />
      </div>

      {iban && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t("ibanChangeWarning", { days: cooldownDays })}
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "..." : t("saveBankDetails")}
        </button>
        {iban && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setIbanInput(iban);
              setHolderInput(accountHolderName ?? "");
              setError(null);
            }}
            disabled={pending}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
          >
            {t("cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
