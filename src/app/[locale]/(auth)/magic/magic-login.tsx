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
    <div className="w-full">
        {state === "pending" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="size-8 animate-spin text-[var(--primary)]" />
            <h1 className="cc-display text-[40px] text-[var(--foreground)] sm:text-[48px]">{t("magicLoggingIn")}</h1>
            <p className="text-sm text-muted-foreground">{t("magicLoggingInHint")}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-2 rounded-[12px] bg-[var(--pastel-pink)] p-3 text-sm text-[var(--foreground)]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{t("magicInvalid")}</span>
            </div>
            <Link
              href="/login"
              className="cc-pill inline-flex w-full items-center justify-center gap-1.5 bg-[var(--primary)] px-6 py-4 text-sm font-semibold leading-none text-white transition-colors hover:bg-[var(--primary-hover)]"
            >
              {t("magicBackToLogin")}
            </Link>
          </div>
        )}
    </div>
  );
}
