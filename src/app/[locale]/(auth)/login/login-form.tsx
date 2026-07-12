"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { login } from "@/actions/auth";
import { Mail, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/auth/password-input";

interface LoginFormProps {
  locale: string;
}

/**
 * Twee-staps login (Fase 16-followup): stap 1 = e-mail + wachtwoord; is 2FA
 * actief (en het apparaat niet vertrouwd), dan verschijnt stap 2 met alléén
 * het Google Authenticator-veld — de gegevens blijven in state, niet opnieuw
 * invullen. Controlled inputs + onSubmit i.p.v. form-action wegens de React 19
 * form-action-reset (zelfde patroon als bid-section, Fase 32).
 */
export function LoginForm({ locale }: LoginFormProps) {
  const t = useTranslations("auth");
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    if (rememberMe) formData.set("rememberMe", "on");
    if (step === "totp") {
      formData.set("totpCode", totpCode);
      if (trustDevice) formData.set("trustDevice", "on");
    }

    startTransition(async () => {
      const result = await login(formData);
      if (result && "success" in result && result.success) {
        window.location.href = `/${locale}`;
        return;
      }
      if (result && "totpRequired" in result && result.totpRequired) {
        setStep("totp");
        setTotpCode("");
        setError("error" in result && result.error ? result.error : null);
        return;
      }
      setError(result && "error" in result && result.error ? result.error : null);
    });
  }

  function backToCredentials() {
    setStep("credentials");
    setTotpCode("");
    setTrustDevice(false);
    setError(null);
  }

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-background px-4 pb-12 pt-16 sm:px-8 lg:px-12 lg:pt-[12vh]">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center lg:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {step === "credentials" ? t("loginTitle") : "Nog één stap"}
          </h1>
          {step === "credentials" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("loginSubtitle")}{" "}
              <Link href="/register" className="font-semibold text-primary hover:underline">
                {t("registerButton")}
              </Link>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Je gegevens kloppen — bevestig nu met je Google Authenticator-code.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === "credentials" ? (
            <>
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/google_auth.webp"
                    alt=""
                    width={20}
                    height={20}
                    className="rounded"
                  />
                  <Label htmlFor="totpCode" className="text-sm font-medium text-foreground">
                    Google Authenticator
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vul de 6-cijferige code uit je authenticator-app in.
                </p>
                <Input
                  id="totpCode"
                  name="totpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={9}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456"
                  className="h-11 text-center text-lg tracking-[0.3em]"
                />
                <label className="flex cursor-pointer items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    Dit apparaat 30 dagen vertrouwen
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={backToCredentials}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Ander account gebruiken
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t("loginPending") : step === "totp" ? "Bevestig en log in" : t("loginButton")}
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
