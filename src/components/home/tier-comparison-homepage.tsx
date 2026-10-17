"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import {
  Sparkles,
  Zap,
  Crown,
  Building2,
  Check,
  Minus,
  ArrowRight,
} from "lucide-react";
import {
  ACCOUNT_TIERS,
  type TierKey,
  type BillingCycle,
  YEARLY_DISCOUNT,
} from "@/lib/subscription-tiers";
import { Link } from "@/i18n/navigation";
import { AnimatedSection } from "@/components/home/animated-section";
import { buildTierFeatureRows } from "@/lib/tier-feature-rows";

const TIER_ORDER: TierKey[] = ["FREE", "PRO", "UNLIMITED", "ENTERPRISE"];

const TIER_ICON: Record<TierKey, typeof Sparkles> = {
  FREE: Sparkles,
  PRO: Zap,
  UNLIMITED: Crown,
  ENTERPRISE: Building2,
};

const TIER_ACCENT: Record<TierKey, string> = {
  FREE: "text-slate-500",
  PRO: "text-sky-600",
  UNLIMITED: "text-amber-600",
  ENTERPRISE: "text-violet-600",
};

const TIER_RING: Record<TierKey, string> = {
  FREE: "ring-border",
  PRO: "ring-sky-300",
  UNLIMITED: "ring-amber-300",
  ENTERPRISE: "ring-violet-300",
};

interface TierComparisonHomepageProps {
  bgClass?: string;
  /** When true, CTAs go to `/dashboard/abonnement` (logged-in FREE users managing
   *  their subscription) instead of `/register`. */
  isLoggedIn?: boolean;
}

export function TierComparisonHomepage({ bgClass = "section-gradient", isLoggedIn = false }: TierComparisonHomepageProps) {
  const t = useTranslations();
  const format = useFormatter();
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");

  return (
    <section className={`py-16 lg:py-24 ${bgClass}`}>
      <div className="mx-auto max-w-[1880px] px-[clamp(1rem,3vw,4rem)]">
        <AnimatedSection>
          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
              <Crown className="size-3" />
              {t("home.tierBenefitsHomepageEyebrow")}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t("home.tierBenefitsHomepageTitle")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("home.tierBenefitsHomepageSubtitle")}
            </p>
          </div>

          {/* Billing toggle */}
          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setCycle("MONTHLY")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  cycle === "MONTHLY"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("subscription.billingToggleMonthly")}
              </button>
              <button
                type="button"
                onClick={() => setCycle("YEARLY")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  cycle === "YEARLY"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("subscription.billingToggleYearly")}
                <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  −{Math.round(YEARLY_DISCOUNT * 100)}%
                </span>
              </button>
            </div>
          </div>

          {/* Tier grid */}
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {TIER_ORDER.map((tierKey) => (
              <TierCard
                key={tierKey}
                tierKey={tierKey}
                cycle={cycle}
                isLoggedIn={isLoggedIn}
                t={t}
                formatCurrency={(n: number) =>
                  format.number(n, { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 === 0 ? 0 : 2 })
                }
              />
            ))}
          </div>

          {/* Footer note */}
          <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
            {t("home.tierBenefitsHomepageFootnote")}
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}

function TierCard({
  tierKey,
  cycle,
  isLoggedIn,
  t,
  formatCurrency,
}: {
  tierKey: TierKey;
  cycle: BillingCycle;
  isLoggedIn: boolean;
  t: ReturnType<typeof useTranslations>;
  formatCurrency: (n: number) => string;
}) {
  const tier = ACCOUNT_TIERS[tierKey];
  const tSub = useTranslations("subscription");
  const Icon = TIER_ICON[tierKey];
  const isPopular = tierKey === "PRO";

  const yearlyPrice = tier.yearlyPrice;
  const monthlyEquivalent = yearlyPrice != null ? yearlyPrice / 12 : tier.monthlyPrice;
  const displayPrice = cycle === "YEARLY" && yearlyPrice != null ? yearlyPrice : tier.monthlyPrice;
  const cycleSuffix =
    tierKey === "FREE"
      ? null
      : cycle === "YEARLY" && yearlyPrice != null
        ? t("subscription.perYear")
        : t("subscription.perMonth");

  // Eén bron van waarheid met /dashboard/abonnement (Fase 45).
  const features = buildTierFeatureRows(tier, tSub);

  // CTA destination — twee contexten:
  // 1. logged-out → /register(?plan=X), Enterprise via /register?plan=ENTERPRISE
  //    omdat het aanvraag-formulier login vereist.
  // 2. logged-in (alleen FREE-tier users zien deze sectie) → /dashboard/abonnement
  //    voor PRO/UNLIMITED upgrade, /dashboard/abonnement/enterprise-aanvraag voor Enterprise.
  let ctaHref: string;
  let ctaLabel: string;
  if (isLoggedIn) {
    if (tierKey === "FREE") {
      ctaHref = "/dashboard/abonnement";
      ctaLabel = t("home.tierCtaCurrentPlan");
    } else if (tierKey === "ENTERPRISE") {
      ctaHref = "/dashboard/abonnement/enterprise-aanvraag";
      ctaLabel = t("home.tierCtaContactSales");
    } else {
      ctaHref = "/dashboard/abonnement";
      ctaLabel = t("home.tierCtaUpgradeTo", { tier: t(`subscription.${tier.nameKey}`) });
    }
  } else {
    ctaHref = "/register";
    ctaLabel = t("home.tierCtaRegisterFree");
    if (tierKey === "PRO" || tierKey === "UNLIMITED") {
      ctaHref = `/register?plan=${tierKey}`;
      ctaLabel = t("home.tierCtaRegisterPaid", { tier: t(`subscription.${tier.nameKey}`) });
    } else if (tierKey === "ENTERPRISE") {
      ctaHref = "/register?plan=ENTERPRISE";
      ctaLabel = t("home.tierCtaContactSales");
    }
  }

  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-card ring-1 ${TIER_RING[tierKey]} ${
        isPopular ? "lg:scale-105 lg:shadow-card-hover" : ""
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-card">
          {t("home.tierPopularBadge")}
        </div>
      )}

      <div className={`inline-flex size-10 items-center justify-center rounded-lg bg-muted ${TIER_ACCENT[tierKey]}`}>
        <Icon className="size-5" />
      </div>

      <h3 className="mt-4 text-lg font-bold text-foreground">{t(`subscription.${tier.nameKey}`)}</h3>
      <p className="mt-1 min-h-[2.5rem] text-sm leading-snug text-muted-foreground">
        {t(`subscription.${tier.nameKey}Tagline`)}
      </p>

      {/* Price */}
      <div className="mt-5">
        {tierKey === "FREE" ? (
          <div className="text-4xl font-extrabold tracking-tight text-foreground">
            {t("subscription.free")}
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1">
              <div className="text-4xl font-extrabold tracking-tight text-foreground">
                {formatCurrency(displayPrice)}
              </div>
              {cycleSuffix && (
                <div className="pb-1 text-sm text-muted-foreground">{cycleSuffix}</div>
              )}
            </div>
            {cycle === "YEARLY" && yearlyPrice != null && (
              <div className="mt-1 text-xs text-muted-foreground">
                {t("subscription.monthlyEquivalent", {
                  price: monthlyEquivalent.toFixed(2).replace(".", ","),
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((f) => (
          <li
            key={f.key}
            className={`flex items-start gap-2 text-sm ${
              f.on ? "text-foreground" : "text-muted-foreground/50 line-through"
            }`}
          >
            {f.on ? (
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
            )}
            <span className="leading-snug" title={f.on && f.tooltip ? f.tooltip : undefined}>{f.label}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={ctaHref}
        className={`mt-6 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
          isPopular
            ? "bg-sky-600 text-white hover:bg-sky-700"
            : tierKey === "ENTERPRISE"
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "border border-border bg-background text-foreground hover:bg-muted"
        }`}
      >
        {ctaLabel}
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
