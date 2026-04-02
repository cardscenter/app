"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { login } from "@/actions/auth";
import { useActionState } from "react";

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await login(formData);
      if (result && "success" in result && result.success) {
        window.location.href = `/${locale}`;
        return null;
      }
      return result ?? null;
    },
    null
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {t("loginTitle")}
          </h1>
        </div>

        <form action={formAction} className="glass rounded-2xl p-8 space-y-6">
          {state?.error && (
            <div className="glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground placeholder-muted-foreground"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              {t("password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground placeholder-muted-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
          >
            {pending ? "..." : t("loginButton")}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("registerButton")}
          </Link>
        </p>
      </div>
    </div>
  );
}
