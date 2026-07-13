"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Gavel,
  Store,
  PlusCircle,
  Truck,
  UserCircle,
  ArrowRight,
  PartyPopper,
  MapPin,
  ShieldCheck,
  Check,
} from "lucide-react";
import type { User } from "@prisma/client";
import { AddressForm } from "@/components/dashboard/address-form";
import { SellingScopeToggle } from "@/components/dashboard/selling-scope-toggle";
import type { SellingScope } from "@/lib/shipping/static-methods";

type StepKey = "address" | "scope" | "twofa" | "discover";

interface WelcomeOnboardingProps {
  user: User;
  /** Alle 5 adresvelden gevuld — zo ja, geen adres-stap (vangnet voor
   *  pre-Fase-43-accounts; verse registraties hebben altijd een adres). */
  addressComplete: boolean;
  scope: SellingScope;
  originCountry: string | null;
  neighbors: string[];
  totpEnabled: boolean;
}

/**
 * Onboarding-wizard op /welkom (Fase 43). Landing na de klik op de
 * verificatie-link: benut het aanmeld-momentum om ontbrekende profielinfo te
 * vragen. Stateless — geen DB-tracking van wizard-voortgang; bij herbezoek
 * verdwijnen voltooide stappen vanzelf doordat de server-props veranderen.
 * Elke stap is skipbaar.
 */
export function WelcomeOnboarding({
  user,
  addressComplete,
  scope,
  originCountry,
  neighbors,
  totpEnabled,
}: WelcomeOnboardingProps) {
  const t = useTranslations("auth");

  const steps: StepKey[] = [
    ...(addressComplete ? [] : (["address"] as StepKey[])),
    ...(originCountry ? (["scope"] as StepKey[]) : []),
    ...(totpEnabled ? [] : (["twofa"] as StepKey[])),
    "discover",
  ];

  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  function next() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  const stepLabels: Record<StepKey, string> = {
    address: t("onboardingStepAddress"),
    scope: t("onboardingStepScope"),
    twofa: t("onboardingStep2fa"),
    discover: t("onboardingStepDiscover"),
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <PartyPopper className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t("welcomeTitle")}</h1>
          <p className="text-muted-foreground">{t("onboardingSubtitle")}</p>
        </div>

        {/* Progress dots */}
        {steps.length > 1 && (
          <div className="flex items-center justify-center gap-2">
            {steps.map((key, i) => {
              const isActive = i === stepIndex;
              const isDone = i < stepIndex;
              return (
                <div key={key} className="flex items-center gap-2">
                  <div
                    className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                      isDone
                        ? "bg-primary/10 text-primary"
                        : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone && <Check className="size-3" />}
                    {stepLabels[key]}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Step: adres-vangnet (alleen incomplete adressen — pre-Fase-43) */}
        {step === "address" && (
          <div className="glass rounded-2xl p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {t("onboardingAddressTitle")}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("onboardingAddressDesc")}
                </p>
              </div>
            </div>
            <AddressForm user={user} onSaved={next} />
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={next}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("onboardingSkip")}
              </button>
            </div>
          </div>
        )}

        {/* Step: verzendgebied bevestigen */}
        {step === "scope" && originCountry && (
          <div className="glass rounded-2xl p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <Truck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {t("onboardingScopeTitle")}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("onboardingScopeDesc")}
                </p>
              </div>
            </div>
            <SellingScopeToggle
              current={scope}
              originCountry={originCountry}
              neighbors={neighbors}
            />
            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover"
              >
                {t("onboardingScopeConfirm")}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step: 2FA-nudge (optioneel) */}
        {step === "twofa" && (
          <div className="glass rounded-2xl p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {t("onboarding2faTitle")}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("onboarding2faDesc")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/google_auth.webp"
                alt=""
                width={20}
                height={20}
                className="rounded"
              />
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                {t("onboarding2faHint")}
              </span>
            </div>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                href="/dashboard/profiel"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover"
              >
                {t("onboarding2faCta")}
              </Link>
              <button
                type="button"
                onClick={next}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("onboarding2faLater")}
              </button>
            </div>
          </div>
        )}

        {/* Step: ontdekken (de oorspronkelijke /welkom-kaartjes) */}
        {step === "discover" && <DiscoverCards />}
      </div>
    </div>
  );
}

function DiscoverCards() {
  const t = useTranslations("auth");
  const actions = [
    {
      href: "/veilingen" as const,
      icon: Gavel,
      title: t("welcomeAuctions"),
      description: t("welcomeAuctionsDesc"),
      color: "bg-blue-500",
    },
    {
      href: "/marktplaats" as const,
      icon: Store,
      title: t("welcomeMarketplace"),
      description: t("welcomeMarketplaceDesc"),
      color: "bg-emerald-500",
    },
    {
      href: "/marktplaats/nieuw" as const,
      icon: PlusCircle,
      title: t("welcomeCreateListing"),
      description: t("welcomeCreateListingDesc"),
      color: "bg-amber-500",
    },
    {
      href: "/dashboard/verzending" as const,
      icon: Truck,
      title: t("welcomeShipping"),
      description: t("welcomeShippingDesc"),
      color: "bg-purple-500",
    },
    {
      href: "/dashboard/profiel" as const,
      icon: UserCircle,
      title: t("welcomeProfile"),
      description: t("welcomeProfileDesc"),
      color: "bg-pink-500",
    },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map(({ href, icon: Icon, title, description, color }) => (
          <Link
            key={href}
            href={href}
            className="group glass rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${color} text-white`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                  {title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
            </div>
          </Link>
        ))}
      </div>

      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
        >
          {t("welcomeStart")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
