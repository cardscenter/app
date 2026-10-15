"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

/**
 * Wisselt het magic-link-token in voor een sessie. Eén poging (ref-guard
 * tegen React Strict Mode dubbel-mount), daarna door naar het dashboard.
 */
export function MagicLogin({ locale, token }: { locale: string; token: string | null }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<"pending" | "error">(token ? "pending" : "error");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    signIn("magic-link", { token, redirect: false })
      .then((res) => {
        if (res?.ok && !res.error) {
          window.location.href = `/${locale}/dashboard`;
        } else {
          setState("error");
        }
      })
      .catch(() => setState("error"));
  }, [token, locale]);

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-background px-4 pb-12 pt-16 sm:px-8 lg:px-12 lg:pt-[12vh]">
      <div className="w-full max-w-md">
        {state === "pending" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("magicLoggingIn")}</h1>
            <p className="text-sm text-muted-foreground">{t("magicLoggingInHint")}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{t("magicInvalid")}</span>
            </div>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary-hover"
            >
              {t("magicBackToLogin")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
