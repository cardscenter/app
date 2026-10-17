"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteOwnAccount } from "@/actions/account";
import { PasswordInput } from "@/components/auth/password-input";
import { Callout } from "@/components/dashboard/ui/callout";
import { buttonVariants } from "@/components/ui/button-variants";
import { INPUT } from "@/components/ploy/tile-styles";

/**
 * Account verwijderen (AVG, Community Hub Fase 2): uitklapbaar blok met
 * wachtwoord + typ VERWIJDER (+ 2FA-code als die aan staat). Na succes:
 * uitgelogd en naar de homepage.
 */
export function DeleteAccountForm({ locale, totpEnabled }: { locale: string; totpEnabled: boolean }) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await deleteOwnAccount({ password, confirmText, totpCode: totpCode || undefined });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      window.location.href = `/${locale}?deleted=1`;
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonVariants({ variant: "destructive" })}
      >
        <Trash2 className="size-4" />
        {t("deleteAccountButton")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--background)] p-4">
      <Callout tone="pink" icon={AlertTriangle}>
        {t("deleteAccountWarning")}
      </Callout>
      <PasswordInput
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("deleteAccountPassword")}
        autoComplete="current-password"
        required
      />
      {totpEnabled && (
        <input
          type="text"
          inputMode="numeric"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value)}
          placeholder={t("deleteAccountTotp")}
          className={`block ${INPUT}`}
        />
      )}
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={t("deleteAccountConfirmPlaceholder")}
        className={`block ${INPUT}`}
        required
      />
      {error && <Callout tone="pink">{error}</Callout>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="cc-pill inline-flex h-9 items-center gap-1.5 bg-[var(--destructive)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--destructive)]/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          {t("deleteAccountConfirm")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className={buttonVariants({ variant: "ghost" })}
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
