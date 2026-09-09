"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { register } from "@/actions/auth";
import { useState, useActionState, Suspense, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { EUROPEAN_COUNTRIES } from "@/lib/shipping/countries";
import {
  User,
  Building2,
  MapPin,
  Camera,
  Settings,
  ChevronRight,
  ChevronLeft,
  Check,
  Upload,
  X,
  ShoppingCart,
  Store,
  ArrowLeftRight,
  Sparkles,
  UserRound,
  KeyRound,
  Pencil,
} from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { UsernameAvailabilityIndicator } from "@/components/auth/username-availability-indicator";
import { ACCOUNT_TIERS, type TierKey } from "@/lib/subscription-tiers";
import { USERNAME_MAX, USERNAME_MIN, USERNAME_REGEX } from "@/lib/username-policy";

/**
 * Registratie (Fase 45-redesign): 5 stappen met het accounttype als éérste
 * keuze — particulier of bedrijf — zodat het formulier (en later de
 * winkelpagina) daar direct op inspeelt.
 *
 *  1 Type · 2 Account · 3 Gegevens & adres (+ bedrijfsgegevens) · 4 Foto/logo
 *  · 5 Voorkeuren + samenvatting + voorwaarden
 */
const TOTAL_STEPS = 5;

// NL KvK = 8 cijfers; overige landen vrij (6-14 alfanumeriek). Btw-id = landcode + 2-12 tekens.
const KVK_NL_REGEX = /^\d{8}$/;
const REG_ID_REGEX = /^[0-9A-Za-z.-]{6,14}$/;
const VAT_REGEX = /^[A-Z]{2}[A-Z0-9]{2,12}$/;

interface FormData {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountKind: "INDIVIDUAL" | "BUSINESS" | "";
  firstName: string;
  lastName: string;
  city: string;
  country: string;
  companyName: string;
  cocNumber: string;
  vatNumber: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  avatarUrl: string;
  avatarFile: File | null;
  accountFocus: "BUYING" | "SELLING" | "BOTH" | "";
  referralSource: string;
  termsAccepted: boolean;
}

export function RegisterForm() {
  return (
    <Suspense>
      <MultiStepRegisterForm />
    </Suspense>
  );
}

function MultiStepRegisterForm() {
  const t = useTranslations("auth");
  const tSub = useTranslations("subscription");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";

  // `?plan=PRO|UNLIMITED|ENTERPRISE` voor plan-selectie via homepage TierCards.
  const planParam = searchParams.get("plan")?.toUpperCase() ?? null;
  const selectedPlan: TierKey | null =
    planParam && planParam !== "FREE" && planParam in ACCOUNT_TIERS
      ? (planParam as TierKey)
      : null;

  const [currentStep, setCurrentStep] = useState(1);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormData>({
    displayName: "",
    email: prefillEmail,
    password: "",
    confirmPassword: "",
    accountKind: "",
    firstName: "",
    lastName: "",
    city: "",
    country: locale === "nl" ? "NL" : "",
    companyName: "",
    cocNumber: "",
    vatNumber: "",
    street: "",
    houseNumber: "",
    postalCode: "",
    avatarUrl: "",
    avatarFile: null,
    accountFocus: "",
    referralSource: "",
    termsAccepted: false,
  });

  const [serverState, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, fd: globalThis.FormData) => {
      const result = await register(fd);
      if (!result || ("success" in result && result.success)) {
        // Eénmalige "Welkom," ipv "Welkom terug," op de homepage.
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

  const isBusiness = formData.accountKind === "BUSINESS";

  function validateStep(step: number): boolean {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.accountKind) errors.accountKind = t("typeRequired");
    }

    if (step === 2) {
      if (!formData.displayName || formData.displayName.length < USERNAME_MIN) errors.displayName = `Minimaal ${USERNAME_MIN} tekens`;
      else if (formData.displayName.length > USERNAME_MAX) errors.displayName = `Maximaal ${USERNAME_MAX} tekens`;
      else if (!USERNAME_REGEX.test(formData.displayName)) errors.displayName = "Alleen letters, cijfers, - en _";
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errors.email = "Ongeldig e-mailadres";
      if (!formData.password || formData.password.length < 8) errors.password = "Minimaal 8 tekens";
      if (formData.password !== formData.confirmPassword) errors.confirmPassword = "Wachtwoorden komen niet overeen";
    }

    if (step === 3) {
      if (!formData.firstName.trim()) errors.firstName = "Verplicht";
      if (!formData.lastName.trim()) errors.lastName = "Verplicht";
      // Adres verplicht sinds Fase 43 — account moet direct shipping-geldig zijn.
      if (!formData.street.trim()) errors.street = "Verplicht";
      if (!formData.houseNumber.trim()) errors.houseNumber = "Verplicht";
      if (!formData.postalCode.trim()) errors.postalCode = "Verplicht";
      if (!formData.city.trim()) errors.city = "Verplicht";
      if (!formData.country) errors.country = "Verplicht";
      if (isBusiness) {
        if (!formData.companyName.trim()) errors.companyName = "Verplicht";
        const coc = formData.cocNumber.trim();
        if (!coc) errors.cocNumber = "Verplicht";
        else if (formData.country === "NL" ? !KVK_NL_REGEX.test(coc) : !REG_ID_REGEX.test(coc)) {
          errors.cocNumber = formData.country === "NL" ? t("cocInvalidNl") : t("cocInvalid");
        }
        const vat = formData.vatNumber.trim().toUpperCase();
        if (vat && !VAT_REGEX.test(vat)) errors.vatNumber = t("vatInvalid");
      }
    }

    // Stap 4 (foto) is optioneel

    if (step === 5) {
      if (!formData.accountFocus) errors.accountFocus = "Maak een keuze";
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
    if (!validateStep(5)) return;

    const fd = new globalThis.FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === "avatarFile") return; // apart
      fd.set(key, String(value));
    });
    fd.set("vatNumber", formData.vatNumber.trim().toUpperCase());
    if (formData.avatarFile) fd.set("avatarFile", formData.avatarFile);
    if (selectedPlan) fd.set("selectedPlan", selectedPlan);
    formAction(fd);
  }

  const steps = [
    { icon: UserRound, label: t("stepType") },
    { icon: KeyRound, label: t("stepAccount") },
    { icon: MapPin, label: t("stepDetails") },
    { icon: Camera, label: isBusiness ? t("stepLogo") : t("stepPhoto") },
    { icon: Settings, label: t("stepPreferences") },
  ];

  return (
    <div className="w-full max-w-xl space-y-5">
      {selectedPlan && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/30">
          <Sparkles className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="flex-1 text-sky-900 dark:text-sky-200">
            <span className="font-semibold">
              {t("planBannerRegisteringFor", {
                tier: tSub(ACCOUNT_TIERS[selectedPlan].nameKey as "tierFree" | "tierPro" | "tierUnlimited" | "tierEnterprise"),
              })}
            </span>
            <span className="ml-1.5 text-sky-700/80 dark:text-sky-300/80">{t("planBannerAfterRegister")}</span>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("registerTitle")}</h1>
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isDone
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                      : "border-border bg-card text-muted-foreground"
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

      {/* Gekozen type als chip boven latere stappen */}
      {currentStep > 1 && formData.accountKind && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-2 text-foreground">
            {isBusiness ? <Building2 className="size-4 text-primary" /> : <User className="size-4 text-primary" />}
            {isBusiness ? t("typeBusinessTitle") : t("typeIndividualTitle")}
          </span>
          <button type="button" onClick={() => goTo(1)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Pencil className="size-3" />
            {t("change")}
          </button>
        </div>
      )}

      {/* Form-kaart */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
        {serverState?.error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {serverState.error}
          </div>
        )}

        {currentStep === 1 && <StepType formData={formData} updateField={updateField} errors={stepErrors} t={t} />}
        {currentStep === 2 && <StepAccount formData={formData} updateField={updateField} errors={stepErrors} t={t} />}
        {currentStep === 3 && <StepDetails formData={formData} updateField={updateField} errors={stepErrors} t={t} locale={locale} />}
        {currentStep === 4 && <StepPhoto formData={formData} updateField={updateField} t={t} />}
        {currentStep === 5 && <StepPreferences formData={formData} updateField={updateField} errors={stepErrors} t={t} locale={locale} />}

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
            {currentStep === 4 && (
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
              >
                {t("next")}
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
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
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function StepType({ formData, updateField, errors, t }: StepProps) {
  const options = [
    {
      kind: "INDIVIDUAL" as const,
      icon: User,
      title: t("typeIndividualTitle"),
      desc: t("typeIndividualDesc"),
      bullets: [t("typeIndividualB1"), t("typeIndividualB2"), t("typeIndividualB3")],
    },
    {
      kind: "BUSINESS" as const,
      icon: Building2,
      title: t("typeBusinessTitle"),
      desc: t("typeBusinessDesc"),
      bullets: [t("typeBusinessB1"), t("typeBusinessB2"), t("typeBusinessB3")],
    },
  ];
  return (
    <div>
      <StepHeading title={t("typeTitle")} description={t("typeSubtitle")} />
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(({ kind, icon: Icon, title, desc, bullets }) => {
          const selected = formData.accountKind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => updateField("accountKind", kind)}
              aria-pressed={selected}
              className={`flex flex-col items-start rounded-xl border-2 p-4 text-left transition ${
                selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <span className={`flex size-10 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Icon className="size-5" />
              </span>
              <span className="mt-3 text-base font-semibold text-foreground">{title}</span>
              <span className="mt-0.5 text-sm text-muted-foreground">{desc}</span>
              <ul className="mt-3 space-y-1">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-1.5 text-xs text-foreground/80">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                    {b}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <FieldError error={errors.accountKind} />
      <p className="mt-4 text-xs text-muted-foreground">{t("typeNote")}</p>
    </div>
  );
}

function StepAccount({ formData, updateField, errors, t }: StepProps) {
  return (
    <div className="space-y-5">
      <StepHeading title={t("stepAccount")} description={t("accountSubtitle")} />

      <div>
        <label htmlFor="displayName" className={LABEL}>
          {t("displayName")}
        </label>
        <input
          id="displayName"
          type="text"
          maxLength={USERNAME_MAX}
          autoComplete="username"
          value={formData.displayName}
          onChange={(e) => updateField("displayName", e.target.value)}
          className={INPUT}
        />
        <p className="mt-1 text-xs text-muted-foreground">{t("displayNameHint", { min: USERNAME_MIN, max: USERNAME_MAX })}</p>
        <FieldError error={errors.displayName} />
        <UsernameAvailabilityIndicator displayName={formData.displayName} />
      </div>

      <div>
        <label htmlFor="email" className={LABEL}>
          {t("email")}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={(e) => updateField("email", e.target.value)}
          className={INPUT}
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
            autoComplete="new-password"
            value={formData.password}
            onChange={(e) => updateField("password", e.target.value)}
            large={false}
            className={`${INPUT} pr-10`}
          />
          <FieldError error={errors.password} />
        </div>
        <div>
          <label htmlFor="confirmPassword" className={LABEL}>
            {t("confirmPassword")}
          </label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={(e) => updateField("confirmPassword", e.target.value)}
            large={false}
            className={`${INPUT} pr-10`}
          />
          <FieldError error={errors.confirmPassword} />
        </div>
      </div>
      <PasswordStrengthMeter password={formData.password} />
    </div>
  );
}

function StepDetails({ formData, updateField, errors, t, locale }: StepProps & { locale: string }) {
  const isBusiness = formData.accountKind === "BUSINESS";
  return (
    <div className="space-y-5">
      <StepHeading title={t("stepDetails")} description={t("detailsSubtitle")} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className={LABEL}>
            {t("firstName")}
          </label>
          <input id="firstName" type="text" autoComplete="given-name" value={formData.firstName} onChange={(e) => updateField("firstName", e.target.value)} className={INPUT} />
          <FieldError error={errors.firstName} />
        </div>
        <div>
          <label htmlFor="lastName" className={LABEL}>
            {t("lastName")}
          </label>
          <input id="lastName" type="text" autoComplete="family-name" value={formData.lastName} onChange={(e) => updateField("lastName", e.target.value)} className={INPUT} />
          <FieldError error={errors.lastName} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="size-4 text-primary" />
          {t("addressTitle")}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="street" className={LABEL}>
              {t("street")}
            </label>
            <input id="street" type="text" autoComplete="address-line1" value={formData.street} onChange={(e) => updateField("street", e.target.value)} className={INPUT} />
            <FieldError error={errors.street} />
          </div>
          <div>
            <label htmlFor="houseNumber" className={LABEL}>
              {t("houseNumber")}
            </label>
            <input id="houseNumber" type="text" value={formData.houseNumber} onChange={(e) => updateField("houseNumber", e.target.value)} className={INPUT} />
            <FieldError error={errors.houseNumber} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="postalCode" className={LABEL}>
              {t("postalCode")}
            </label>
            <input id="postalCode" type="text" autoComplete="postal-code" value={formData.postalCode} onChange={(e) => updateField("postalCode", e.target.value)} className={INPUT} />
            <FieldError error={errors.postalCode} />
          </div>
          <div>
            <label htmlFor="city" className={LABEL}>
              {t("city")}
            </label>
            <input id="city" type="text" autoComplete="address-level2" value={formData.city} onChange={(e) => updateField("city", e.target.value)} className={INPUT} />
            <FieldError error={errors.city} />
          </div>
          <div>
            <label htmlFor="country" className={LABEL}>
              {t("country")}
            </label>
            <select id="country" value={formData.country} onChange={(e) => updateField("country", e.target.value)} className={INPUT}>
              <option value="">—</option>
              {EUROPEAN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {locale === "en" ? c.nameEn : c.nameNl}
                </option>
              ))}
            </select>
            <FieldError error={errors.country} />
          </div>
        </div>
      </div>

      {isBusiness && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="size-4 text-primary" />
            {t("businessDetailsTitle")}
          </p>
          <p className="mb-3 text-xs text-muted-foreground">{t("businessDetailsHint")}</p>
          <div>
            <label htmlFor="companyName" className={LABEL}>
              {t("companyName")}
            </label>
            <input id="companyName" type="text" autoComplete="organization" value={formData.companyName} onChange={(e) => updateField("companyName", e.target.value)} className={INPUT} />
            <FieldError error={errors.companyName} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cocNumber" className={LABEL}>
                {formData.country === "NL" ? t("cocNumber") : t("businessRegistrationId")}
              </label>
              <input
                id="cocNumber"
                type="text"
                inputMode={formData.country === "NL" ? "numeric" : "text"}
                value={formData.cocNumber}
                onChange={(e) => updateField("cocNumber", e.target.value)}
                placeholder={formData.country === "NL" ? "12345678" : undefined}
                className={INPUT}
              />
              <FieldError error={errors.cocNumber} />
            </div>
            <div>
              <label htmlFor="vatNumber" className={LABEL}>
                {t("vatNumber")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
              </label>
              <input id="vatNumber" type="text" value={formData.vatNumber} onChange={(e) => updateField("vatNumber", e.target.value)} placeholder="NL123456789B01" className={INPUT} />
              <FieldError error={errors.vatNumber} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepPhoto({ formData, updateField, t }: Omit<StepProps, "errors">) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusiness = formData.accountKind === "BUSINESS";

  function handleFileSelect(file: File) {
    const previewUrl = URL.createObjectURL(file);
    updateField("avatarUrl", previewUrl);
    updateField("avatarFile", file);
  }

  function handleRemove() {
    if (formData.avatarUrl) URL.revokeObjectURL(formData.avatarUrl);
    updateField("avatarUrl", "");
    updateField("avatarFile", null);
  }

  return (
    <div className="space-y-5">
      <StepHeading
        title={isBusiness ? t("logoTitle") : t("photoTitle")}
        description={isBusiness ? t("logoDescription") : t("photoDescription")}
      />

      <div className="flex flex-col items-center gap-4">
        <div className="relative size-32 overflow-hidden rounded-[22%] bg-muted ring-4 ring-background">
          {formData.avatarUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={formData.avatarUrl} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white transition-opacity hover:bg-black/80"
                aria-label={t("removePhoto")}
              >
                <X className="size-3.5" />
              </button>
            </>
          ) : (
            <div className="flex size-full items-center justify-center">
              {isBusiness ? <Building2 className="size-14 text-muted-foreground/40" /> : <User className="size-16 text-muted-foreground/40" />}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          <Upload className="size-4" />
          {formData.avatarUrl ? t("changePhoto") : t("uploadPhoto")}
        </button>

        <p className="text-xs text-muted-foreground">JPG, PNG of WebP — max 5MB</p>
      </div>
    </div>
  );
}

function StepPreferences({ formData, updateField, errors, t, locale }: StepProps & { locale: string }) {
  const isBusiness = formData.accountKind === "BUSINESS";
  const focusOptions = [
    { value: "BUYING" as const, icon: ShoppingCart, label: t("focusBuying"), desc: t("focusBuyingDesc") },
    { value: "SELLING" as const, icon: Store, label: t("focusSelling"), desc: t("focusSellingDesc") },
    { value: "BOTH" as const, icon: ArrowLeftRight, label: t("focusBoth"), desc: t("focusBothDesc") },
  ];
  const countryName = EUROPEAN_COUNTRIES.find((c) => c.code === formData.country);

  return (
    <div className="space-y-6">
      <div>
        <StepHeading title={t("accountFocus")} />
        <div className="space-y-2">
          {focusOptions.map(({ value, icon: Icon, label, desc }) => {
            const selected = formData.accountFocus === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => updateField("accountFocus", value)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ${
                  selected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </button>
            );
          })}
        </div>
        <FieldError error={errors.accountFocus} />
      </div>

      <div>
        <label htmlFor="referralSource" className={LABEL}>
          {t("referralSource")}
        </label>
        <select id="referralSource" value={formData.referralSource} onChange={(e) => updateField("referralSource", e.target.value)} className={INPUT}>
          <option value="">{t("referralNone")}</option>
          <option value="google">{t("referralGoogle")}</option>
          <option value="social_media">{t("referralSocialMedia")}</option>
          <option value="friend">{t("referralFriend")}</option>
          <option value="youtube">{t("referralYoutube")}</option>
          <option value="forum">{t("referralForum")}</option>
          <option value="other">{t("referralOther")}</option>
        </select>
      </div>

      {/* Samenvatting */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("summaryTitle")}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <SummaryRow label={t("accountKind")} value={isBusiness ? t("typeBusinessTitle") : t("typeIndividualTitle")} />
          <SummaryRow label={t("displayName")} value={formData.displayName} />
          <SummaryRow label={t("email")} value={formData.email.trim().toLowerCase()} />
          <SummaryRow
            label={t("city")}
            value={[formData.city, countryName ? (locale === "en" ? countryName.nameEn : countryName.nameNl) : formData.country].filter(Boolean).join(", ")}
          />
          {isBusiness && <SummaryRow label={t("companyName")} value={formData.companyName} />}
          {isBusiness && <SummaryRow label={formData.country === "NL" ? t("cocNumber") : t("businessRegistrationId")} value={formData.cocNumber} />}
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
