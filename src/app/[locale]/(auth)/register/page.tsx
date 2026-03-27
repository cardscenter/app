"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { register } from "@/actions/auth";
import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";
  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string } | null | undefined, formData: FormData) => {
      const result = await register(formData);
      return result ?? null;
    },
    null
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {t("registerTitle")}
          </h1>
        </div>

        <form action={formAction} className="glass rounded-2xl p-8 space-y-6">
          {state?.error && (
            <div className="glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-destructive dark:bg-red-950/30">
              {state.error}
            </div>
          )}

          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-foreground"
            >
              {t("displayName")}
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground placeholder-muted-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={prefillEmail}
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground placeholder-muted-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
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

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-foreground"
            >
              {t("confirmPassword")}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
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
            {pending ? "..." : t("registerButton")}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            {t("loginButton")}
          </Link>
        </p>
      </div>
    </div>
  );
}
