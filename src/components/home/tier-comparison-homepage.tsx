"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import {
  Sparkles,
  Zap,
  Crown,
  Building2,
  Check,
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

const TIER_ORDER: TierKey[] = ["FREE", "PRO", "UNLIMITED", "ENTERPRISE"];

const TIER_ICON: Record<TierKey, typeof Sparkles> = {
  FREE: Sparkles,
  PRO: Zap,
  UNLIMITED: Crown,
  ENTERPRISE: Building2,
};

const TIER_ACCENT: Record<TierKey, string> = {
  FREE: "text-slate-500 dark:text-slate-400",
  PRO: "text-sky-600 dark:text-sky-400",
  UNLIMITED: "text-amber-600 dark:text-amber-400",
  ENTERPRISE: "text-violet-600 dark:text-violet-400",
};

const TIER_RING: Record<TierKey, string> = {
  FREE: "ring-border",
  PRO: "ring-sky-300 dark:ring-sky-500/40",
  UNLIMITED: "ring-amber-300 dark:ring-amber-500/40",
  ENTERPRISE: "ring-violet-300 dark:ring-violet-500/40",
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
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <AnimatedSection>
          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
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
                <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
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

  // Build feature list — IDENTIEKE rijen voor elke card, alleen waarde + on/off verschilt.
  // Greyed-out + line-through betekent: deze tier heeft 'm niet.
  const features: { label: string; on: boolean; tooltip?: string }[] = [];

  // 1. Commissie
  features.push({
    label: t("subscription.featureCommission", {
      rate: (tier.commissionRate * 100).toFixed(1).replace(/\.0$/, ""),
    }),
    on: true,
    tooltip: t("subscription.commissionBaseTooltip"),
  });

  // 2-4. Limits — 3 aparte rijen, met "Onbeperkt"-variant bij Infinity
  features.push({
    label:
      tier.limits.maxActiveAuctions === Infinity
        ? t("subscription.featureActiveAuctionsUnlimited")
        : t("subscription.featureActiveAuctions", { count: tier.limits.maxActiveAuctions }),
    on: true,
  });
  features.push({
    label:
      tier.limits.maxActiveClaimsales === Infinity
        ? t("subscription.featureActiveClaimsalesUnlimited")
        : t("subscription.featureActiveClaimsales", { count: tier.limits.maxActiveClaimsales }),
    on: true,
  });
  features.push({
    label:
      tier.limits.maxActiveListings === Infinity
        ? t("subscription.featureActiveListingsUnlimited")
        : t("subscription.featureActiveListings", { count: tier.limits.maxActiveListings }),
    on: true,
  });

  // 5. Items per claimsale
  features.push({
    label:
      tier.limits.maxItemsPerClaimsale === Infinity
        ? t("subscription.featureItemsPerClaimsaleUnlimited")
        : t("subscription.featureItemsPerClaimsale", { count: tier.limits.maxItemsPerClaimsale }),
    on: true,
  });

  // 6. Korting op upsells (always shown; greyed-out bij 0%)
  features.push({
    label:
      tier.upsellDiscount > 0
        ? t("subscription.featureUpsellDiscount", {
            percent: Math.round(tier.upsellDiscount * 100),
          })
        : t("subscription.featureUpsellDiscountNone"),
    on: tier.upsellDiscount > 0,
  });

  // 7. Gratis homepage-spotlights (always shown; greyed-out bij 0)
  // 999+ = onbeperkt (Enterprise)
  const spotlightCount = tier.limits.freeHomepageSpotlightsPerMonth;
  features.push({
    label:
      spotlightCount === 0
        ? t("subscription.featureFreeHomepageSpotlightNone")
        : spotlightCount >= 999
          ? t("subscription.featureFreeHomepageSpotlightUnlimited")
          : spotlightCount === 1
            ? t("subscription.featureFreeHomepageSpotlight", { count: spotlightCount })
            : t("subscription.featureFreeHomepageSpotlightPlural", { count: spotlightCount }),
    on: spotlightCount > 0,
  });

  // 8-14. Boolean features — altijd zichtbaar, on/off bepaalt styling
  features.push({ label: t("subscription.featureBulkUpload"), on: tier.features.bulkUpload });
  features.push({ label: t("subscription.featureCustomProfile"), on: tier.features.customProfile });
  features.push({ label: t("subscription.featureVanityShopSlug"), on: tier.features.vanityShopSlug });
  features.push({ label: t("subscription.featureSearchBoost"), on: tier.features.searchBoost });
  features.push({ label: t("subscription.featureStatistics"), on: tier.features.statistics });
  features.push({ label: t("subscription.featurePrioritySupport"), on: tier.features.prioritySupport });
  features.push({ label: t("subscription.featureAccountManager"), on: tier.features.accountManager });

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
        {features.map((f, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 text-sm ${
              f.on ? "text-foreground" : "text-muted-foreground/50 line-through"
            }`}
          >
            <Check
              className={`mt-0.5 size-4 shrink-0 ${
                f.on ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/40"
              }`}
            />
            <span className="leading-snug">{f.label}</span>
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
