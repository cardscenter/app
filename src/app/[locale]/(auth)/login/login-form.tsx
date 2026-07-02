"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { login } from "@/actions/auth";
import { useActionState } from "react";
import { Mail, AlertCircle, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/auth/password-input";

interface LoginFormProps {
  locale: string;
}

export function LoginForm({ locale }: LoginFormProps) {
  const t = useTranslations("auth");
  const [rememberMe, setRememberMe] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await login(formData);
      if (result && "success" in result && result.success) {
        window.location.href = `/${locale}`;
        return null;
      }
      return result ?? null;
    },
    null,
  );

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-background px-4 pb-12 pt-16 sm:px-8 lg:px-12 lg:pt-[12vh]">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center lg:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("loginTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("loginSubtitle")}{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              {t("registerButton")}
            </Link>
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          {state?.error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">
              {t("email")}
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="naam@voorbeeld.nl"
                className="h-11 pl-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                {t("password")}
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("forgotPasswordLink")}
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="rememberMe"
              name="rememberMe"
              checked={rememberMe}
              onCheckedChange={(c) => setRememberMe(c === true)}
            />
            <Label
              htmlFor="rememberMe"
              className="cursor-pointer text-sm text-muted-foreground"
            >
              {t("rememberMe")}
            </Label>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t("loginPending") : t("loginButton")}
            {!pending && <ArrowRight className="size-4" />}
          </button>
        </form>

        {/* Trust footer (mobile-only — desktop heeft de aside) */}
        <p className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
          {t("mobileTrustFooter")}
        </p>
      </div>
    </div>
  );
}
