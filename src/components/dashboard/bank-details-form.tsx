"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateBankDetails } from "@/actions/profile";
import { formatIbanForDisplay } from "@/lib/validations/iban";
import { TotpStepUpField } from "@/components/dashboard/totp-step-up-field";
import { Callout } from "@/components/dashboard/ui/callout";
import { buttonVariants } from "@/components/ui/button-variants";
import { INPUT, LABEL, PILL_BTN_SM } from "@/components/ploy/tile-styles";

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
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");

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
    if (totpCode) formData.set("totpCode", totpCode);

    startTransition(async () => {
      const result = await updateBankDetails(formData);
      if (result.error) {
        if ("totpRequired" in result && result.totpRequired) setTotpRequired(true);
        setError(result.error);
        return;
      }
      toast.success(t("bankSaved"));
      setEditing(false);
      setTotpRequired(false);
      setTotpCode("");
      router.refresh();
    });
  }

  if (!editing && iban) {
    return (
      <div className="space-y-3 rounded-[12px] border border-[var(--border)] bg-white px-4 py-3.5">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("ibanLabel")}</p>
          <p className="font-mono text-sm text-foreground">{formatIbanForDisplay(iban)}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("accountHolderLabel")}</p>
          <p className="text-sm text-foreground">{accountHolderName ?? "—"}</p>
        </div>

        {cooldownActive && (
          <Callout tone="yellow">{t("ibanCooldown", { days: daysRemaining })}</Callout>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={cooldownActive}
          className={`${PILL_BTN_SM} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {t("editBankDetails")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("bankDetailsHelp")}</p>

      <div>
        <label htmlFor="iban" className={LABEL}>
          {t("ibanLabel")}
        </label>
        <input
          id="iban"
          name="iban"
          type="text"
          value={ibanInput}
          onChange={(e) => setIbanInput(e.target.value)}
          placeholder="NL91 ABNA 0417 1643 00"
          className={`${INPUT} font-mono uppercase`}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>

      <div>
        <label htmlFor="accountHolderName" className={LABEL}>
          {t("accountHolderLabel")}
        </label>
        <input
          id="accountHolderName"
          name="accountHolderName"
          type="text"
          value={holderInput}
          onChange={(e) => setHolderInput(e.target.value)}
          className={INPUT}
          autoComplete="off"
          required
        />
      </div>

      {iban && <Callout tone="yellow">{t("ibanChangeWarning", { days: cooldownDays })}</Callout>}

      {totpRequired && <TotpStepUpField value={totpCode} onChange={setTotpCode} />}

      {error && <Callout tone="pink">{error}</Callout>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className={buttonVariants()}
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
            className={buttonVariants({ variant: "outline" })}
          >
            {t("cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
