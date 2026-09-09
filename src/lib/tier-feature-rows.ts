import type { TierConfig } from "@/lib/subscription-tiers";

/**
 * Eén bron van waarheid voor de tier-featurelijst (Fase 45). Gebruikt door
 * `TierGrid` (/dashboard/abonnement) én `TierComparisonHomepage` (homepage),
 * die voorheen elk hun eigen — onderling afwijkende — rijenbouwer hadden.
 *
 * Altijd dezelfde 15 rijen per tier; `on` bepaalt of de rij actief (vinkje)
 * of uitgeschakeld (grijs + doorgestreept) rendert, zodat de kaarten netjes
 * uitlijnen. `t` is de `subscription`-namespace-vertaler.
 */
export interface TierFeatureRow {
  key: string;
  label: string;
  on: boolean;
  tooltip?: string;
}

type Translator = (key: string, values?: Record<string, string | number>) => string;

const formatRate = (rate: number) => (rate * 100).toFixed(1).replace(/\.0$/, "");

export function buildTierFeatureRows(tier: TierConfig, t: Translator): TierFeatureRow[] {
  const { limits, features } = tier;
  const spotlights = limits.freeHomepageSpotlightsPerMonth;

  return [
    {
      key: "commission",
      label: t("featureCommission", { rate: formatRate(tier.commissionRate) }),
      on: true,
      tooltip: t("commissionBaseTooltip"),
    },
    {
      key: "activeAuctions",
      label:
        limits.maxActiveAuctions === Infinity
          ? t("featureActiveAuctionsUnlimited")
          : t("featureActiveAuctions", { count: limits.maxActiveAuctions }),
      on: true,
    },
    {
      key: "activeClaimsales",
      label:
        limits.maxActiveClaimsales === Infinity
          ? t("featureActiveClaimsalesUnlimited")
          : t("featureActiveClaimsales", { count: limits.maxActiveClaimsales }),
      on: true,
    },
    {
      key: "activeListings",
      label:
        limits.maxActiveListings === Infinity
          ? t("featureActiveListingsUnlimited")
          : t("featureActiveListings", { count: limits.maxActiveListings }),
      on: true,
    },
    {
      key: "itemsPerClaimsale",
      label:
        limits.maxItemsPerClaimsale === Infinity
          ? t("featureItemsPerClaimsaleUnlimited")
          : t("featureItemsPerClaimsale", { count: limits.maxItemsPerClaimsale }),
      on: true,
    },
    {
      key: "upsellDiscount",
      label:
        tier.upsellDiscount > 0
          ? t("featureUpsellDiscount", { percent: Math.round(tier.upsellDiscount * 100) })
          : t("featureUpsellDiscountNone"),
      on: tier.upsellDiscount > 0,
    },
    {
      key: "freeSpotlights",
      label:
        spotlights === 0
          ? t("featureFreeHomepageSpotlightNone")
          : spotlights >= 999
            ? t("featureFreeHomepageSpotlightUnlimited")
            : spotlights === 1
              ? t("featureFreeHomepageSpotlight", { count: spotlights })
              : t("featureFreeHomepageSpotlightPlural", { count: spotlights }),
      on: spotlights > 0,
    },
    { key: "bulkUpload", label: t("featureBulkUpload"), on: features.bulkUpload },
    { key: "statistics", label: t("featureStatistics"), on: features.statistics },
    {
      key: "extendedPriceHistory",
      label: t("featureExtendedPriceHistory"),
      on: features.extendedPriceHistory,
    },
    { key: "customProfile", label: t("featureCustomProfile"), on: features.customProfile },
    { key: "vanityShopSlug", label: t("featureVanityShopSlug"), on: features.vanityShopSlug },
    { key: "searchBoost", label: t("featureSearchBoost"), on: features.searchBoost },
    { key: "prioritySupport", label: t("featurePrioritySupport"), on: features.prioritySupport },
    { key: "accountManager", label: t("featureAccountManager"), on: features.accountManager },
  ];
}
