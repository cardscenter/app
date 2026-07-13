"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { updateEmailPreferences } from "@/actions/profile";
import {
  EMAIL_PREF_CATEGORIES,
  type EmailPreferences,
  type EmailPrefCategory,
} from "@/lib/email/preferences-config";

/**
 * E-mailvoorkeuren als settings-rijen (Fase 44, verhuisd van /meldingen).
 * Zelfde optimistic-toggle-patroon als voorheen: direct flippen, server
 * action in transition, terugdraaien bij error, groene check bij succes.
 */
export function EmailPreferenceRows({
  initialPrefs,
  emailVerified,
}: {
  initialPrefs: EmailPreferences;
  emailVerified: boolean;
}) {
  const t = useTranslations("notifications");
  const [prefs, setPrefs] = useState(initialPrefs);
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
    <div>
      {!emailVerified && (
        <div className="mb-3 mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("emailPrefs.verifyHint")}</span>
        </div>
      )}

      <div className="divide-y divide-border">
        {EMAIL_PREF_CATEGORIES.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 py-4 first:pt-3 last:pb-3"
          >
            <div className="min-w-0">
              <label htmlFor={`email-pref-${key}`} className="text-sm font-medium text-foreground">
                {label}
              </label>
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            </div>
            <Switch
              id={`email-pref-${key}`}
              checked={prefs[key]}
              disabled={isPending}
              onCheckedChange={(value) => handleToggle(key, value)}
            />
          </div>
        ))}

        <div className="flex items-center justify-between gap-4 py-4 opacity-70">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              {t("emailPrefs.alwaysOn")}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("emailPrefs.alwaysOnDesc")}</p>
          </div>
          <Switch checked disabled />
        </div>
      </div>

      <div className="flex h-5 items-center justify-end gap-2">
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {savedFlash && !isPending && <Check className="h-4 w-4 text-emerald-500" />}
      </div>
    </div>
  );
}
