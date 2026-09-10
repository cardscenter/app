"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Check, Loader2, Lock, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { changeUsername } from "@/actions/profile";
import { USERNAME_MAX, USERNAME_MIN, validateUsername } from "@/lib/username-policy";
import { formatCurrency, formatDateShort } from "@/lib/format";

type Props = {
  currentName: string;
  /** Mag de gebruiker de eenmalige, betaalde wijziging nog doen? */
  canChange: boolean;
  /** Wanneer de eenmalige wijziging is verbruikt (null = nog beschikbaar). */
  usedAt: Date | string | null;
  fee: number;
};

/**
 * Gebruikersnaam-rij op /dashboard/profiel.
 *
 * De naam is geen gewoon profielveld meer: je mag hem één keer zelf wijzigen
 * (betaald), daarna staat hij vast en kan alleen support hem nog aanpassen.
 * Daarom staat dit los van het profielformulier — met een expliciete
 * bevestigingsstap, zodat niemand per ongeluk betaalt.
 *
 * Let op: dit component rendert bínnen het profielformulier, dus geen eigen
 * `<form>` (nested forms zijn ongeldig) en geen `name`-attribuut op de input.
 * Enter in het veld bevestigt de wijziging in plaats van het profiel op te slaan.
 */
export function UsernameChangeForm({ currentName, canChange, usedAt, fee }: Props) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const feeLabel = formatCurrency(fee, locale === "en" ? "en-IE" : "nl-NL");
  const trimmed = value.trim();
  const isDifferent = trimmed.toLowerCase() !== currentName.toLowerCase();
  const check = isDifferent ? validateUsername(trimmed) : { ok: true as const };
  const canSubmit = trimmed.length > 0 && isDifferent && check.ok && !pending;

  function submit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const res = await changeUsername(trimmed);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      toast.success(t("usernameChanged"));
      // Header leest de naam uit de sessie-JWT → laat 'm de sessie verversen.
      window.dispatchEvent(new Event("session-refresh"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
          <span className="text-muted-foreground">@</span>
          {currentName}
        </span>

        {canChange ? (
          !open && (
            <button
              type="button"
              onClick={() => {
                setValue(currentName);
                setError(null);
                setOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Pencil className="size-3.5" />
              {t("usernameChangeButton", { fee: feeLabel })}
            </button>
          )
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5" />
            {t("usernameLocked")}
          </span>
        )}
      </div>

      {!canChange && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {usedAt
            ? t("usernameLockedHintOn", {
                date: formatDateShort(usedAt, locale === "en" ? "en-GB" : "nl-NL"),
              })
            : t("usernameLockedHint")}{" "}
          <Link href="/support" className="font-medium text-primary hover:underline">
            {t("contactSupport")}
          </Link>
        </p>
      )}

      {canChange && !open && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("usernameChangeHint", { fee: feeLabel })}
        </p>
      )}

      {open && (
        <div className="space-y-3 rounded-xl border border-amber-300/70 bg-amber-50 p-3.5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              {t("usernameChangeTitle")}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tc("cancel")}
              className="shrink-0 text-amber-700/70 transition-colors hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-200"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
            {t("usernameChangeWarning", { fee: feeLabel })}
          </p>

          <div className="relative flex rounded-lg border border-border bg-card transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
            <span className="flex select-none items-center border-r border-border bg-muted/60 px-3 text-sm text-muted-foreground">
              @
            </span>
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                // Binnen het profielformulier: Enter mag het profiel niet opslaan.
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              maxLength={USERNAME_MAX}
              autoComplete="off"
              spellCheck={false}
              aria-label={t("displayName")}
              className="block w-full bg-transparent px-3 py-2.5 pr-10 text-sm text-foreground outline-none"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              {canSubmit && (
                <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t("displayNameHint", { min: USERNAME_MIN, max: USERNAME_MAX })}
          </p>

          {!check.ok && trimmed.length > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400">{check.error}</p>
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              {t("usernameChangeConfirm", { fee: feeLabel })}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              {tc("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
