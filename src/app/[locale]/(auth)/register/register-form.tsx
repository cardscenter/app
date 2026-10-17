"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { register } from "@/actions/auth";
import { useState, useActionState, Suspense, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { EUROPEAN_COUNTRIES } from "@/lib/shipping/countries";
import {
  Camera,
  Settings,
  ChevronRight,
  ChevronLeft,
  Check,
  Upload,
  X,
  KeyRound,
  UserRound,
  Cake,
} from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { UsernameAvailabilityIndicator } from "@/components/auth/username-availability-indicator";
import { USERNAME_MAX, USERNAME_MIN, USERNAME_REGEX } from "@/lib/username-policy";
import { GUARDIAN_CONSENT_AGE, ageOn, isPlausibleDateOfBirth, parseDateOfBirth } from "@/lib/age";
import type { GameDefinition } from "@/lib/games";

/**
 * Registratie (Community Hub, Fase 2): vier korte stappen voor spelers.
 *
 *  1 Account (gebruikersnaam, e-mail, wachtwoord)
 *  2 Over jou (naam, geboortedatum, woonplaats, land, favoriete spellen)
 *  3 Foto (optioneel)
 *  4 Voorkeuren (nieuwsbrief-opt-in, samenvatting, voorwaarden)
 *
 * Geen accounttype-keuze en geen verplicht adres meer: dat hoorde bij de
 * marktplaats. Bedrijfsaccounts ontstaan later via convertToBusinessAccount.
 */
const TOTAL_STEPS = 4;

interface FormData {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  country: string;
  favoriteGames: string[];
  avatarUrl: string;
  avatarFile: File | null;
  referralSource: string;
  newsletterOptIn: boolean;
  termsAccepted: boolean;
}

export function RegisterForm({ games }: { games: GameDefinition[] }) {
  return (
    <Suspense>
      <MultiStepRegisterForm games={games} />
    </Suspense>
  );
}

function MultiStepRegisterForm({ games }: { games: GameDefinition[] }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";

  const [currentStep, setCurrentStep] = useState(1);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormData>({
    displayName: "",
    email: prefillEmail,
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    city: "",
    country: locale === "nl" ? "NL" : "",
    favoriteGames: [],
    avatarUrl: "",
    avatarFile: null,
    referralSource: "",
    newsletterOptIn: false,
    termsAccepted: false,
  });

  const [serverState, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, fd: globalThis.FormData) => {
      const result = await register(fd);
      if (!result || ("success" in result && result.success)) {
        try {
          window.localStorage.setItem("cards-center-new-user", "1");
        } catch {
          // localStorage kan disabled zijn in privacy-mode.
        }
        const redirectTo =
          result && "redirectTo" in result && result.redirectTo
            ? `/${locale}${result.redirectTo}`
            : `/${locale}`;
        window.location.href = redirectTo;
        return null;
      }
      return result;
    },
    null,
  );

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setStepErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  function validateStep(step: number): boolean {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.displayName || formData.displayName.length < USERNAME_MIN) errors.displayName = `Minimaal ${USERNAME_MIN} tekens`;
      else if (formData.displayName.length > USERNAME_MAX) errors.displayName = `Maximaal ${USERNAME_MAX} tekens`;
      else if (!USERNAME_REGEX.test(formData.displayName)) errors.displayName = "Alleen letters, cijfers, - en _";
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errors.email = "Ongeldig e-mailadres";
      if (!formData.password || formData.password.length < 8) errors.password = "Minimaal 8 tekens";
      if (formData.password !== formData.confirmPassword) errors.confirmPassword = "Wachtwoorden komen niet overeen";
    }

    if (step === 2) {
      if (!formData.firstName.trim()) errors.firstName = "Verplicht";
      if (!formData.lastName.trim()) errors.lastName = "Verplicht";
      const dob = parseDateOfBirth(formData.dateOfBirth);
      if (!dob) errors.dateOfBirth = t("dobRequired");
      else if (!isPlausibleDateOfBirth(dob)) errors.dateOfBirth = t("dobInvalid");
      if (!formData.country) errors.country = "Verplicht";
    }

    // Stap 3 (foto) is optioneel

    if (step === 4) {
      if (!formData.termsAccepted) errors.termsAccepted = "Verplicht";
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function goNext() {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goPrev() {
    setStepErrors({});
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  function goTo(step: number) {
    setStepErrors({});
    setCurrentStep(step);
  }

  function skipStep() {
    setStepErrors({});
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function handleSubmit() {
    if (!validateStep(4)) return;

    const fd = new globalThis.FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === "avatarFile" || key === "favoriteGames") return; // apart
      fd.set(key, String(value));
    });
    for (const g of formData.favoriteGames) fd.append("favoriteGames", g);
    if (formData.avatarFile) fd.set("avatarFile", formData.avatarFile);
    formAction(fd);
  }

  const steps = [
    { icon: KeyRound, label: t("stepAccount") },
    { icon: UserRound, label: t("stepAboutYou") },
    { icon: Camera, label: t("stepPhoto") },
    { icon: Settings, label: t("stepPreferences") },
  ];

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="cc-display text-[40px] text-[var(--foreground)] sm:text-[48px]">{t("registerTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("step", { current: currentStep, total: TOTAL_STEPS })}</p>
      </div>

      {/* Stappenbalk — chips met nummer + label, voltooide stappen klikbaar */}
      <ol className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => {
          const n = i + 1;
          const isActive = n === currentStep;
          const isDone = n < currentStep;
          const Icon = s.icon;
          return (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => isDone && goTo(n)}
                disabled={!isDone}
                className={`cc-pill inline-flex h-8 items-center gap-1.5 border px-3 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                    : isDone
                      ? "border-transparent bg-[var(--pastel-green)] text-[var(--foreground)] hover:opacity-90"
                      : "border-[var(--border)] bg-white text-[var(--foreground)]/55"
                } disabled:cursor-default`}
              >
                {isDone ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{n}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Form-kaart */}
      <div className="pt-2">
        {serverState?.error && (
          <div className="mb-6 rounded-[12px] bg-[var(--pastel-pink)] p-3 text-sm text-[var(--foreground)]">
            {serverState.error}
          </div>
        )}

        {currentStep === 1 && <StepAccount formData={formData} updateField={updateField} errors={stepErrors} t={t} />}
        {currentStep === 2 && <StepAboutYou formData={formData} updateField={updateField} errors={stepErrors} t={t} locale={locale} games={games} />}
        {currentStep === 3 && <StepPhoto formData={formData} updateField={updateField} t={t} />}
        {currentStep === 4 && <StepPreferences formData={formData} updateField={updateField} errors={stepErrors} t={t} locale={locale} games={games} />}

        {/* Navigatie */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={goPrev}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              {t("previous")}
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {currentStep === 3 && (
              <button
                type="button"
                onClick={skipStep}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("skipForNow")}
              </button>
            )}

            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={goNext}
                className="cc-pill cc-grad inline-flex items-center gap-1.5 px-6 py-4 text-sm font-semibold leading-none text-white"
              >
                {t("next")}
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="cc-pill cc-grad inline-flex items-center gap-1.5 px-6 py-4 text-sm font-semibold leading-none text-white disabled:opacity-50"
              >
                {pending ? "..." : t("createAccount")}
                {!pending && <Check className="size-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("loginButton")}
        </Link>
      </p>
    </div>
  );
}

/* ============================================================
   STAP-COMPONENTEN
   ============================================================ */

interface StepProps {
  formData: FormData;
  updateField: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
  errors: Record<string, string>;
  t: ReturnType<typeof useTranslations<"auth">>;
}

const INPUT = "mt-1 block w-full glass-input px-3 py-2.5 text-foreground placeholder-muted-foreground";
const LABEL = "block text-sm font-medium text-foreground";

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-destructive">{error}</p>;
}

function StepHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

/* ---------- Stap 1: Account ---------- */
function StepAccount({ formData, updateField, errors, t }: StepProps) {
  return (
    <div className="space-y-4">
      <StepHeading title={t("stepAccount")} description={t("accountSubtitle")} />

      <div>
        <label htmlFor="displayName" className={LABEL}>
          {t("displayName")}
        </label>
        <div className="relative">
          <input
            id="displayName"
            type="text"
            value={formData.displayName}
            onChange={(e) => updateField("displayName", e.target.value)}
            className={`${INPUT} pr-10`}
            placeholder="bv. ashketchum"
            maxLength={USERNAME_MAX}
            autoComplete="username"
          />
          <UsernameAvailabilityIndicator displayName={formData.displayName} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("displayNameHint", { min: USERNAME_MIN, max: USERNAME_MAX })}</p>
        <FieldError error={errors.displayName} />
      </div>

      <div>
        <label htmlFor="email" className={LABEL}>
          {t("email")}
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => updateField("email", e.target.value)}
          className={INPUT}
          placeholder="naam@voorbeeld.nl"
          autoComplete="email"
        />
        <FieldError error={errors.email} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className={LABEL}>
            {t("password")}
          </label>
          <PasswordInput
            id="password"
            value={formData.password}
            onChange={(e) => updateField("password", e.target.value)}
            autoComplete="new-password"
            className="mt-1"
          />
          <PasswordStrengthMeter password={formData.password} />
          <FieldError error={errors.password} />
        </div>
        <div>
          <label htmlFor="confirmPassword" className={LABEL}>
            {t("confirmPassword")}
          </label>
          <PasswordInput
            id="confirmPassword"
            value={formData.confirmPassword}
            onChange={(e) => updateField("confirmPassword", e.target.value)}
            autoComplete="new-password"
            className="mt-1"
          />
          <FieldError error={errors.confirmPassword} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Stap 2: Over jou ---------- */
function StepAboutYou({ formData, updateField, errors, t, locale, games }: StepProps & { locale: string; games: GameDefinition[] }) {
  const dob = parseDateOfBirth(formData.dateOfBirth);
  const age = dob && isPlausibleDateOfBirth(dob) ? ageOn(dob) : null;
  const minor = age !== null && age < GUARDIAN_CONSENT_AGE;

  function toggleGame(key: string) {
    const next = formData.favoriteGames.includes(key)
      ? formData.favoriteGames.filter((k) => k !== key)
      : [...formData.favoriteGames, key];
    updateField("favoriteGames", next);
  }

  return (
    <div className="space-y-5">
      <StepHeading title={t("stepAboutYou")} description={t("aboutYouSubtitle")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={LABEL}>
            {t("firstName")}
          </label>
          <input id="firstName" type="text" value={formData.firstName} onChange={(e) => updateField("firstName", e.target.value)} className={INPUT} autoComplete="given-name" maxLength={50} />
          <FieldError error={errors.firstName} />
        </div>
        <div>
          <label htmlFor="lastName" className={LABEL}>
            {t("lastName")}
          </label>
          <input id="lastName" type="text" value={formData.lastName} onChange={(e) => updateField("lastName", e.target.value)} className={INPUT} autoComplete="family-name" maxLength={50} />
          <FieldError error={errors.lastName} />
        </div>
      </div>

      <div>
        <label htmlFor="dateOfBirth" className={LABEL}>
          {t("dateOfBirth")}
        </label>
        <div className="relative">
          <Cake className="pointer-events-none absolute left-3 top-[calc(50%+2px)] size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => updateField("dateOfBirth", e.target.value)}
            className={`${INPUT} pl-9`}
            autoComplete="bday"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("dateOfBirthHint")}</p>
        {minor && (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            {t("minorNotice", { age: GUARDIAN_CONSENT_AGE })}
          </p>
        )}
        <FieldError error={errors.dateOfBirth} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className={LABEL}>
            {t("city")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </label>
          <input id="city" type="text" value={formData.city} onChange={(e) => updateField("city", e.target.value)} className={INPUT} autoComplete="address-level2" maxLength={100} />
        </div>
        <div>
          <label htmlFor="country" className={LABEL}>
            {t("country")}
          </label>
          <select id="country" value={formData.country} onChange={(e) => updateField("country", e.target.value)} className={INPUT} autoComplete="country">
            <option value="">{t("selectCountry")}</option>
            {EUROPEAN_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {locale === "en" ? c.nameEn : c.nameNl}
              </option>
            ))}
          </select>
          <FieldError error={errors.country} />
        </div>
      </div>

      {games.length > 0 && (
        <div>
          <p className={LABEL}>
            {t("favoriteGames")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {games.map((g) => {
              const on = formData.favoriteGames.includes(g.key);
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => toggleGame(g.key)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    on ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-muted/40"
                  }`}
                >
                  {on && <Check className="size-3.5" />}
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Stap 3: Foto ---------- */
function StepPhoto({ formData, updateField, t }: Omit<StepProps, "errors">) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    updateField("avatarFile", file);
    updateField("avatarUrl", URL.createObjectURL(file));
  }

  return (
    <div className="space-y-4">
      <StepHeading title={t("photoTitle")} description={t("photoDescription")} />
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="flex size-28 items-center justify-center overflow-hidden rounded-[22%] border-2 border-dashed border-border bg-muted/40">
            {formData.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={formData.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <Camera className="size-8 text-muted-foreground" />
            )}
          </div>
          {formData.avatarUrl && (
            <button
              type="button"
              onClick={() => {
                updateField("avatarFile", null);
                updateField("avatarUrl", "");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-label={t("removePhoto")}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 text-white shadow"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} className="hidden" id="avatarFile" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Upload className="size-4" />
          {formData.avatarUrl ? t("changePhoto") : t("uploadPhoto")}
        </button>
      </div>
    </div>
  );
}

/* ---------- Stap 4: Voorkeuren ---------- */
function StepPreferences({ formData, updateField, errors, t, locale, games }: StepProps & { locale: string; games: GameDefinition[] }) {
  const countryName = EUROPEAN_COUNTRIES.find((c) => c.code === formData.country);
  const favoriteNames = games.filter((g) => formData.favoriteGames.includes(g.key)).map((g) => g.name);

  return (
    <div className="space-y-6">
      <StepHeading title={t("stepPreferences")} />

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={formData.newsletterOptIn}
            onChange={(e) => updateField("newsletterOptIn", e.target.checked)}
            className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground">
            <span className="font-medium">{t("newsletterOptIn")}</span>
            <span className="block text-xs text-muted-foreground">{t("newsletterOptInHint")}</span>
          </span>
        </label>
      </div>

      <div>
        <label htmlFor="referralSource" className={LABEL}>
          {t("referralSource")}
        </label>
        <select id="referralSource" value={formData.referralSource} onChange={(e) => updateField("referralSource", e.target.value)} className={INPUT}>
          <option value="">{t("referralNone")}</option>
          <option value="shop">{t("referralShop")}</option>
          <option value="google">{t("referralGoogle")}</option>
          <option value="social_media">{t("referralSocialMedia")}</option>
          <option value="friend">{t("referralFriend")}</option>
          <option value="youtube">{t("referralYoutube")}</option>
          <option value="other">{t("referralOther")}</option>
        </select>
      </div>

      {/* Samenvatting */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("summaryTitle")}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <SummaryRow label={t("displayName")} value={formData.displayName} />
          <SummaryRow label={t("email")} value={formData.email.trim().toLowerCase()} />
          <SummaryRow label={t("fullName")} value={`${formData.firstName} ${formData.lastName}`.trim()} />
          <SummaryRow label={t("dateOfBirth")} value={formData.dateOfBirth} />
          <SummaryRow
            label={t("city")}
            value={[formData.city, countryName ? (locale === "en" ? countryName.nameEn : countryName.nameNl) : formData.country].filter(Boolean).join(", ")}
          />
          <SummaryRow label={t("favoriteGames")} value={favoriteNames.join(", ")} />
        </dl>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={formData.termsAccepted}
            onChange={(e) => updateField("termsAccepted", e.target.checked)}
            className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground">
            {t("termsAccept")}{" "}
            <a href="/voorwaarden" target="_blank" className="font-medium text-primary hover:underline">
              {t("termsLink")}
            </a>{" "}
            {t("termsAnd")}{" "}
            <a href="/privacy" target="_blank" className="font-medium text-primary hover:underline">
              {t("privacyLink")}
            </a>
          </span>
        </label>
        <FieldError error={errors.termsAccepted} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}
