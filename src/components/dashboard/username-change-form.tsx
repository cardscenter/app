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
import { useFeature } from "@/components/providers/feature-flags-provider";
import { buttonVariants } from "@/components/ui/button-variants";
import { PILL_BTN_SM } from "@/components/ploy/tile-styles";
import { TONE_SURFACE } from "@/components/dashboard/ui/tones";
import { cn } from "@/lib/utils";

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
export function UsernameChangeForm({ currentName, canChange: canChangeProp, usedAt, fee }: Props) {
  const t = useTranslations("profile");
  // Community Hub (Fase 1): de wijziging kost saldo; zonder FEATURE_WALLET
  // staat de naam op slot en verwijst de hint naar support.
  const walletOn = useFeature("FEATURE_WALLET");
  const canChange = canChangeProp && walletOn;
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
        <span className="inline-flex items-center rounded-[10px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground">
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
              className={PILL_BTN_SM}
            >
              <Pencil className="size-3.5" />
              {t("usernameChangeButton", { fee: feeLabel })}
            </button>
          )
        ) : (
          <span className="cc-pill inline-flex items-center gap-1.5 bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground/70">
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
        <div className={cn("space-y-3 rounded-[14px] p-3.5", TONE_SURFACE.yellow)}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold">
              {t("usernameChangeTitle")}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tc("cancel")}
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <p className="text-xs leading-relaxed opacity-85">
            {t("usernameChangeWarning", { fee: feeLabel })}
          </p>

          <div className="relative flex overflow-hidden rounded-[10px] border border-[var(--border)] bg-white transition-colors focus-within:border-[var(--foreground)]">
            <span className="flex select-none items-center border-r border-[var(--border)] bg-[var(--background)] px-3 text-sm text-muted-foreground">
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
              className="block w-full bg-transparent px-3 py-2 pr-10 text-sm text-foreground outline-none"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              {canSubmit && (
                <span className="flex size-4 items-center justify-center rounded-full bg-[var(--pastel-green-ink)] text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </span>
          </div>

          <p className="text-[11px] opacity-75">
            {t("displayNameHint", { min: USERNAME_MIN, max: USERNAME_MAX })}
          </p>

          {!check.ok && trimmed.length > 0 && (
            <p className="text-xs font-medium text-[var(--destructive)]">{check.error}</p>
          )}
          {error && <p className="text-xs font-medium text-[var(--destructive)]">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className={buttonVariants({ size: "sm" })}
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              {t("usernameChangeConfirm", { fee: feeLabel })}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {tc("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
