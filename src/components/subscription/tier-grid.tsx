"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Zap, Crown, Building2, Check } from "lucide-react";
import {
  ACCOUNT_TIERS,
  TIER_BREAK_EVENS_MONTHLY,
  type TierKey,
  type BillingCycle,
} from "@/lib/subscription-tiers";

const TIER_ICONS: Record<TierKey, typeof Sparkles> = {
  FREE: Sparkles,
  PRO: Zap,
  UNLIMITED: Crown,
  ENTERPRISE: Building2,
};

const TIER_ACCENT: Record<TierKey, string> = {
  FREE: "text-muted-foreground",
  PRO: "text-sky-500",
  UNLIMITED: "text-amber-500",
  ENTERPRISE: "text-violet-500",
};

const TIER_ORDER: TierKey[] = ["FREE", "PRO", "UNLIMITED", "ENTERPRISE"];

interface Props {
  currentAccountType: string;
  hasPendingEnterpriseRequest: boolean;
}

export function TierGrid({ currentAccountType, hasPendingEnterpriseRequest }: Props) {
  const t = useTranslations("subscription");
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");

  const effectiveCurrent = currentAccountType === "ADMIN" ? "ENTERPRISE" : currentAccountType;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-full border border-border bg-muted p-1">
          <button
            type="button"
            onClick={() => setCycle("MONTHLY")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              cycle === "MONTHLY"
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("billingToggleMonthly")}
          </button>
          <button
            type="button"
            onClick={() => setCycle("YEARLY")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              cycle === "YEARLY"
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("billingToggleYearly")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIER_ORDER.map((key) => (
          <TierCard
            key={key}
            tierKey={key}
            cycle={cycle}
            isCurrent={effectiveCurrent === key}
            hasPendingEnterpriseRequest={hasPendingEnterpriseRequest}
          />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {t("auctionPremiumNote")}
      </p>
    </div>
  );
}

interface TierCardProps {
  tierKey: TierKey;
  cycle: BillingCycle;
  isCurrent: boolean;
  hasPendingEnterpriseRequest: boolean;
}

function TierCard({ tierKey, cycle, isCurrent, hasPendingEnterpriseRequest }: TierCardProps) {
  const t = useTranslations("subscription");
  const tier = ACCOUNT_TIERS[tierKey];
  const Icon = TIER_ICONS[tierKey];
  const accent = TIER_ACCENT[tierKey];
  const breakEven = TIER_BREAK_EVENS_MONTHLY[tierKey];

  const limits = tier.limits;
  const limitLine =
    limits.maxActiveListings === Infinity
      ? t("featureLimitsUnlimited")
      : t("featureLimits", {
          auctions: String(limits.maxActiveAuctions),
          listings: String(limits.maxActiveListings),
          claimsales: String(limits.maxActiveClaimsales),
        });
  const itemsLine = t("featureItemsPerClaimsale", {
    count:
      limits.maxItemsPerClaimsale === Infinity
        ? "∞"
        : String(limits.maxItemsPerClaimsale),
  });

  const features: { label: string; on: boolean }[] = [
    { label: t("featureCommission", { rate: (tier.commissionRate * 100).toFixed(tier.commissionRate === 0 ? 0 : 1) }), on: true },
    { label: limitLine, on: true },
    { label: itemsLine, on: true },
  ];

  if (tier.upsellDiscount > 0) {
    features.push({
      label: t("featureUpsellDiscount", { percent: String(Math.round(tier.upsellDiscount * 100)) }),
      on: true,
    });
  }
  if (limits.freeHomepageSpotlightsPerMonth > 0) {
    const isPlural = limits.freeHomepageSpotlightsPerMonth > 1;
    features.push({
      label: (isPlural ? t("featureFreeHomepageSpotlightPlural") : t("featureFreeHomepageSpotlight")).replace(
        "{count}",
        String(limits.freeHomepageSpotlightsPerMonth)
      ),
      on: true,
    });
  }
  if (tier.features.statistics) features.push({ label: t("featureStatistics"), on: true });
  if (tier.features.bulkUpload) features.push({ label: t("featureBulkUpload"), on: true });
  if (tier.features.customProfile) features.push({ label: t("featureCustomProfile"), on: true });
  if (tier.features.vanityShopSlug) features.push({ label: t("featureVanityShopSlug"), on: true });
  if (tier.features.searchBoost) features.push({ label: t("featureSearchBoost"), on: true });
  if (tier.features.prioritySupport) features.push({ label: t("featurePrioritySupport"), on: true });
  if (tier.features.accountManager) features.push({ label: t("featureAccountManager"), on: true });

  const isEnterprise = tierKey === "ENTERPRISE";
  const isFree = tierKey === "FREE";

  let displayPrice: string;
  let displayUnit: string | null;
  let yearlyMonthlyEq: string | null = null;

  if (isFree) {
    displayPrice = t("free");
    displayUnit = null;
  } else if (isEnterprise) {
    displayPrice = `€${tier.monthlyPrice.toFixed(0)}`;
    displayUnit = t("perMonth");
  } else if (cycle === "YEARLY" && tier.yearlyPrice != null) {
    displayPrice = `€${tier.yearlyPrice.toFixed(0)}`;
    displayUnit = t("perYear");
    yearlyMonthlyEq = t("monthlyEquivalent", {
      price: (tier.yearlyPrice / 12).toFixed(2),
    });
  } else {
    displayPrice = `€${tier.monthlyPrice.toFixed(2)}`;
    displayUnit = t("perMonth");
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 p-6 transition ${
        isCurrent
          ? "border-primary bg-primary/5 shadow-card-hover"
          : "border-border bg-card shadow-card"
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${accent}`} />
        <h3 className="text-lg font-bold text-foreground">{t(tier.nameKey)}</h3>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">{t(`${tier.nameKey}Tagline`)}</p>

      <div className="mb-1">
        <span className="text-3xl font-bold text-foreground">{displayPrice}</span>
        {displayUnit && (
          <span className="text-sm font-normal text-muted-foreground">{displayUnit}</span>
        )}
      </div>
      {yearlyMonthlyEq && (
        <p className="mb-4 text-xs text-muted-foreground">{yearlyMonthlyEq}</p>
      )}
      {!yearlyMonthlyEq && <div className="mb-4 h-4" />}

      {breakEven > 0 && (
        <p className="mb-5 text-xs italic text-muted-foreground">
          {isEnterprise
            ? t("breakEvenEnterprise", { amount: breakEven.toLocaleString("nl-NL") })
            : t("breakEvenLabel", { amount: breakEven.toLocaleString("nl-NL") })}
        </p>
      )}
      {breakEven === 0 && <div className="mb-5 h-4" />}

      <ul className="mb-6 space-y-2.5 text-sm">
        {features.map((f, idx) => (
          <li key={idx} className="flex items-start gap-2 text-foreground">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <TierCta
          tierKey={tierKey}
          cycle={cycle}
          isCurrent={isCurrent}
          hasPendingEnterpriseRequest={hasPendingEnterpriseRequest}
        />
      </div>
    </div>
  );
}

interface CtaProps {
  tierKey: TierKey;
  cycle: BillingCycle;
  isCurrent: boolean;
  hasPendingEnterpriseRequest: boolean;
}

function TierCta({ tierKey, cycle, isCurrent, hasPendingEnterpriseRequest }: CtaProps) {
  const t = useTranslations("subscription");
  const tier = ACCOUNT_TIERS[tierKey];

  if (isCurrent) {
    return (
      <div className="w-full rounded-xl bg-primary/10 py-2.5 text-center text-sm font-medium text-primary">
        {t("currentPlan")}
      </div>
    );
  }

  if (tierKey === "FREE") {
    return null;
  }

  if (tierKey === "ENTERPRISE") {
    if (hasPendingEnterpriseRequest) {
      return (
        <div className="w-full cursor-not-allowed rounded-xl bg-muted py-2.5 text-center text-sm font-medium text-muted-foreground">
          {t("enterpriseRequestSubmitted")}
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-xl bg-violet-500/80 py-2.5 text-center text-sm font-medium text-white opacity-50"
        title={t("upgradeSoon")}
      >
        {t("enterpriseRequestCta")}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled
      className="w-full cursor-not-allowed rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-white opacity-50"
      title={t("upgradeSoon")}
    >
      {t("upgradeTo", { tier: t(tier.nameKey) })}
    </button>
  );
}
