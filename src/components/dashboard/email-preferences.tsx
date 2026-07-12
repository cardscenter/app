"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Mail, ShieldCheck, ChevronDown, TriangleAlert } from "lucide-react";
import { updateEmailPreferences } from "@/actions/profile";
import {
  EMAIL_PREF_CATEGORIES,
  type EmailPreferences,
  type EmailPrefCategory,
} from "@/lib/email/preferences-config";

/**
 * E-mailvoorkeuren-sectie op /dashboard/meldingen (Fase 16).
 * Zelfde optimistic-toggle-patroon als BidConfirmationToggle: direct flippen,
 * server action in transition, terugdraaien bij error, groene check bij succes.
 */
export function EmailPreferencesSection({
  initialPrefs,
  emailVerified,
}: {
  initialPrefs: EmailPreferences;
  emailVerified: boolean;
}) {
  const t = useTranslations("notifications");
  const [prefs, setPrefs] = useState(initialPrefs);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);

  function handleToggle(key: EmailPrefCategory, value: boolean) {
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    startTransition(async () => {
      const result = await updateEmailPreferences(next);
      if (result && "error" in result) {
        setPrefs(previous);
        return;
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">
              {t("emailPrefs.title")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("emailPrefs.subtitle")}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {savedFlash && !isPending && <Check className="h-4 w-4 text-emerald-500" />}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          {!emailVerified && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("emailPrefs.verifyHint")}</span>
            </div>
          )}

          <ul className="space-y-3">
            {EMAIL_PREF_CATEGORIES.map(({ key, label, description }) => (
              <li key={key}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    disabled={isPending}
                    onChange={(e) => handleToggle(key, e.target.checked)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{label}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                </label>
              </li>
            ))}

            <li className="flex items-start gap-3 opacity-70">
              <span className="mt-1 flex h-4 w-4 items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {t("emailPrefs.alwaysOn")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("emailPrefs.alwaysOnDesc")}
                </span>
              </span>
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
