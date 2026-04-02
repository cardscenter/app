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
} from "lucide-react";

const TOTAL_STEPS = 4;

interface FormData {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountKind: "INDIVIDUAL" | "BUSINESS";
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

export default function RegisterPage() {
  return (
    <Suspense>
      <MultiStepRegisterForm />
    </Suspense>
  );
}

function MultiStepRegisterForm() {
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
    accountKind: "INDIVIDUAL",
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
        window.location.href = `/${locale}`;
        return null;
      }
      return result;
    },
    null
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
      if (!formData.displayName || formData.displayName.length < 3) errors.displayName = "Minimaal 3 tekens";
      else if (formData.displayName.length > 30) errors.displayName = "Maximaal 30 tekens";
      else if (!/^[a-zA-Z0-9_-]+$/.test(formData.displayName)) errors.displayName = "Alleen letters, cijfers, - en _";
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = "Ongeldig e-mailadres";
      if (!formData.password || formData.password.length < 8) errors.password = "Minimaal 8 tekens";
      if (formData.password !== formData.confirmPassword) errors.confirmPassword = "Wachtwoorden komen niet overeen";
    }

    if (step === 2) {
      if (!formData.firstName.trim()) errors.firstName = "Verplicht";
      if (!formData.lastName.trim()) errors.lastName = "Verplicht";
      if (!formData.city.trim()) errors.city = "Verplicht";
      if (!formData.country) errors.country = "Verplicht";
      if (formData.accountKind === "BUSINESS") {
        if (!formData.companyName.trim()) errors.companyName = "Verplicht";
        if (!formData.cocNumber.trim()) errors.cocNumber = "Verplicht";
      }
    }

    // Step 3 (photo) is optional

    if (step === 4) {
      if (!formData.accountFocus) errors.accountFocus = "Maak een keuze";
      if (!formData.termsAccepted) errors.termsAccepted = "Verplicht";
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function goNext() {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
    }
  }

  function goPrev() {
    setStepErrors({});
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  function skipStep() {
    setStepErrors({});
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function handleSubmit() {
    if (!validateStep(4)) return;

    const fd = new globalThis.FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === "avatarFile") return; // handled separately
      fd.set(key, String(value));
    });
    if (formData.avatarFile) {
      fd.set("avatarFile", formData.avatarFile);
    }
    formAction(fd);
  }

  const stepIcons = [User, MapPin, Camera, Settings];
  const stepLabels = [
    t("stepAccount"),
    t("stepAddress"),
    t("stepPhoto"),
    t("stepPreferences"),
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-6">
        {/* Progress bar */}
        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            {t("step", { current: currentStep, total: TOTAL_STEPS })}
          </p>
          <div className="flex items-center gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
              const StepIcon = stepIcons[i];
              const isActive = i + 1 === currentStep;
              const isDone = i + 1 < currentStep;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                      isDone
                        ? "bg-primary text-primary-foreground"
                        : isActive
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {stepLabels[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form card */}
        <div className="glass rounded-2xl p-8">
          {serverState?.error && (
            <div className="mb-6 glass-subtle rounded-2xl bg-red-50/50 p-4 text-sm text-destructive dark:bg-red-950/30">
              {serverState.error}
            </div>
          )}

          {/* Step 1: Account */}
          {currentStep === 1 && (
            <StepAccount formData={formData} updateField={updateField} errors={stepErrors} t={t} />
          )}

          {/* Step 2: Personal + Address */}
          {currentStep === 2 && (
            <StepDetails formData={formData} updateField={updateField} errors={stepErrors} t={t} locale={locale} />
          )}

          {/* Step 3: Photo */}
          {currentStep === 3 && (
            <StepPhoto formData={formData} updateField={updateField} t={t} />
          )}

          {/* Step 4: Preferences & Terms */}
          {currentStep === 4 && (
            <StepPreferences formData={formData} updateField={updateField} errors={stepErrors} t={t} />
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-3">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goPrev}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
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
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("skipForNow")}
                </button>
              )}

              {currentStep < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
                >
                  {t("next")}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={pending}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
                >
                  {pending ? "..." : t("createAccount")}
                  {!pending && <Check className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Login link */}
        <p className="text-center text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("loginButton")}
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   STEP COMPONENTS
   ============================================================ */

interface StepProps {
  formData: FormData;
  updateField: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
  errors: Record<string, string>;
  t: ReturnType<typeof useTranslations<"auth">>;
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-destructive">{error}</p>;
}

function StepAccount({ formData, updateField, errors, t }: StepProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">{t("stepAccount")}</h2>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-foreground">
          {t("displayName")}
        </label>
        <input
          id="displayName"
          type="text"
          value={formData.displayName}
          onChange={(e) => updateField("displayName", e.target.value)}
          className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground placeholder-muted-foreground"
        />
        <FieldError error={errors.displayName} />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          {t("email")}
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => updateField("email", e.target.value)}
          className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground placeholder-muted-foreground"
        />
        <FieldError error={errors.email} />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
          {t("password")}
        </label>
        <input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => updateField("password", e.target.value)}
          className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground placeholder-muted-foreground"
        />
        <FieldError error={errors.password} />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
          {t("confirmPassword")}
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => updateField("confirmPassword", e.target.value)}
          className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground placeholder-muted-foreground"
        />
        <FieldError error={errors.confirmPassword} />
      </div>
    </div>
  );
}

function StepDetails({ formData, updateField, errors, t, locale }: StepProps & { locale: string }) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">{t("stepAddress")}</h2>

      {/* Account kind toggle */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">{t("accountKind")}</label>
        <div className="grid grid-cols-2 gap-3">
          {(["INDIVIDUAL", "BUSINESS"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => updateField("accountKind", kind)}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                formData.accountKind === kind
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "glass-input text-foreground hover:bg-muted/50"
              }`}
            >
              {kind === "INDIVIDUAL" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              {kind === "INDIVIDUAL" ? t("individual") : t("business")}
            </button>
          ))}
        </div>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-foreground">
            {t("firstName")}
          </label>
          <input
            id="firstName"
            type="text"
            value={formData.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
          <FieldError error={errors.firstName} />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-foreground">
            {t("lastName")}
          </label>
          <input
            id="lastName"
            type="text"
            value={formData.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
          <FieldError error={errors.lastName} />
        </div>
      </div>

      {/* Address fields */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label htmlFor="street" className="block text-sm font-medium text-foreground">
            {t("street")}
          </label>
          <input
            id="street"
            type="text"
            value={formData.street}
            onChange={(e) => updateField("street", e.target.value)}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
        </div>
        <div>
          <label htmlFor="houseNumber" className="block text-sm font-medium text-foreground">
            {t("houseNumber")}
          </label>
          <input
            id="houseNumber"
            type="text"
            value={formData.houseNumber}
            onChange={(e) => updateField("houseNumber", e.target.value)}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="postalCode" className="block text-sm font-medium text-foreground">
            {t("postalCode")}
          </label>
          <input
            id="postalCode"
            type="text"
            value={formData.postalCode}
            onChange={(e) => updateField("postalCode", e.target.value)}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
        </div>
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-foreground">
            {t("city")}
          </label>
          <input
            id="city"
            type="text"
            value={formData.city}
            onChange={(e) => updateField("city", e.target.value)}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
          <FieldError error={errors.city} />
        </div>
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-foreground">
            {t("country")}
          </label>
          <select
            id="country"
            value={formData.country}
            onChange={(e) => updateField("country", e.target.value)}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          >
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

      {/* Business fields */}
      {formData.accountKind === "BUSINESS" && (
        <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4">
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-foreground">
              {t("companyName")}
            </label>
            <input
              id="companyName"
              type="text"
              value={formData.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
            />
            <FieldError error={errors.companyName} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cocNumber" className="block text-sm font-medium text-foreground">
                {formData.country === "NL" ? t("cocNumber") : t("businessRegistrationId")}
              </label>
              <input
                id="cocNumber"
                type="text"
                value={formData.cocNumber}
                onChange={(e) => updateField("cocNumber", e.target.value)}
                className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
              />
              <FieldError error={errors.cocNumber} />
            </div>
            <div>
              <label htmlFor="vatNumber" className="block text-sm font-medium text-foreground">
                {t("vatNumber")}
              </label>
              <input
                id="vatNumber"
                type="text"
                value={formData.vatNumber}
                onChange={(e) => updateField("vatNumber", e.target.value)}
                placeholder="NL123456789B01"
                className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground placeholder-muted-foreground"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepPhoto({ formData, updateField, t }: Omit<StepProps, "errors">) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(file: File) {
    const previewUrl = URL.createObjectURL(file);
    updateField("avatarUrl", previewUrl);
    updateField("avatarFile", file);
  }

  function handleRemove() {
    if (formData.avatarUrl) {
      URL.revokeObjectURL(formData.avatarUrl);
    }
    updateField("avatarUrl", "");
    updateField("avatarFile", null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">{t("photoTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("photoDescription")}</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* Avatar preview */}
        <div className="relative h-32 w-32 overflow-hidden rounded-full bg-muted">
          {formData.avatarUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={formData.avatarUrl}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white transition-opacity hover:bg-black/80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="h-16 w-16 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Upload button */}
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
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
        >
          <Upload className="h-4 w-4" />
          {formData.avatarUrl ? t("changePhoto") : t("uploadPhoto")}
        </button>

        <p className="text-xs text-muted-foreground">JPG, PNG of WebP — max 5MB</p>
      </div>
    </div>
  );
}

function StepPreferences({ formData, updateField, errors, t }: StepProps) {
  const focusOptions = [
    { value: "BUYING" as const, icon: ShoppingCart, label: t("focusBuying"), desc: t("focusBuyingDesc") },
    { value: "SELLING" as const, icon: Store, label: t("focusSelling"), desc: t("focusSellingDesc") },
    { value: "BOTH" as const, icon: ArrowLeftRight, label: t("focusBoth"), desc: t("focusBothDesc") },
  ];

  return (
    <div className="space-y-6">
      {/* Account focus */}
      <div>
        <h2 className="text-xl font-bold text-foreground">{t("accountFocus")}</h2>
        <div className="mt-3 space-y-2">
          {focusOptions.map(({ value, icon: Icon, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateField("accountFocus", value)}
              className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left transition-all ${
                formData.accountFocus === value
                  ? "bg-primary/10 ring-2 ring-primary"
                  : "glass-input hover:bg-muted/50"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  formData.accountFocus === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </button>
          ))}
        </div>
        <FieldError error={errors.accountFocus} />
      </div>

      {/* Referral */}
      <div>
        <label htmlFor="referralSource" className="block text-sm font-medium text-foreground">
          {t("referralSource")}
        </label>
        <select
          id="referralSource"
          value={formData.referralSource}
          onChange={(e) => updateField("referralSource", e.target.value)}
          className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
        >
          <option value="">{t("referralNone")}</option>
          <option value="google">{t("referralGoogle")}</option>
          <option value="social_media">{t("referralSocialMedia")}</option>
          <option value="friend">{t("referralFriend")}</option>
          <option value="youtube">{t("referralYoutube")}</option>
          <option value="forum">{t("referralForum")}</option>
          <option value="other">{t("referralOther")}</option>
        </select>
      </div>

      {/* Terms & conditions */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.termsAccepted}
            onChange={(e) => updateField("termsAccepted", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
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
