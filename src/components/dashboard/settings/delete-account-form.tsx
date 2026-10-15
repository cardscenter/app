"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteOwnAccount } from "@/actions/account";
import { PasswordInput } from "@/components/auth/password-input";

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
        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        <Trash2 className="size-4" />
        {t("deleteAccountButton")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="flex items-start gap-2 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>{t("deleteAccountWarning")}</span>
      </p>
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
          className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground"
        />
      )}
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={t("deleteAccountConfirmPlaceholder")}
        className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground"
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
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
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
