export type TierKey = "FREE" | "PRO" | "UNLIMITED" | "ENTERPRISE";

export interface TierFeatures {
  statistics: boolean;
  prioritySupport: boolean;
  customProfile: boolean;
  bulkUpload: boolean;
  vanityShopSlug: boolean;
  searchBoost: boolean;
  accountManager: boolean;
  /** Diepe prijshistorie (90d + 1j) op kaart-detailpagina. FREE ziet 14d/30d. */
  extendedPriceHistory: boolean;
}

export interface TierLimits {
  maxActiveAuctions: number;
  maxActiveClaimsales: number;
  maxActiveListings: number;
  maxItemsPerClaimsale: number;
  freeHomepageSpotlightsPerMonth: number;
}

export interface TierConfig {
  key: TierKey;
  nameKey: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  commissionRate: number;
  upsellDiscount: number;
  tierRank: number;
  limits: TierLimits;
  features: TierFeatures;
}

export const ACCOUNT_TIERS: Record<TierKey, TierConfig> = {
  FREE: {
    key: "FREE",
    nameKey: "tierFree",
    monthlyPrice: 0,
    yearlyPrice: 0,
    commissionRate: 0.03,
    upsellDiscount: 0,
    tierRank: 1,
    limits: {
      maxActiveAuctions: 1,
      maxActiveClaimsales: 1,
      maxActiveListings: 5,
      maxItemsPerClaimsale: 20,
      freeHomepageSpotlightsPerMonth: 0,
    },
    features: {
      statistics: false,
      prioritySupport: false,
      customProfile: false,
      bulkUpload: false,
      vanityShopSlug: false,
      searchBoost: false,
      accountManager: false,
      extendedPriceHistory: false,
    },
  },
  PRO: {
    key: "PRO",
    nameKey: "tierPro",
    monthlyPrice: 14.95,
    yearlyPrice: 149,
    commissionRate: 0.025,
    upsellDiscount: 0.25,
    tierRank: 2,
    limits: {
      maxActiveAuctions: 10,
      maxActiveClaimsales: 10,
      maxActiveListings: 50,
      maxItemsPerClaimsale: 50,
      freeHomepageSpotlightsPerMonth: 1,
    },
    features: {
      statistics: true,
      prioritySupport: false,
      customProfile: false,
      bulkUpload: true,
      vanityShopSlug: false,
      searchBoost: false,
      accountManager: false,
      extendedPriceHistory: true,
    },
  },
  UNLIMITED: {
    key: "UNLIMITED",
    nameKey: "tierUnlimited",
    monthlyPrice: 39.95,
    yearlyPrice: 399,
    commissionRate: 0.02,
    upsellDiscount: 0.5,
    tierRank: 3,
    limits: {
      maxActiveAuctions: Infinity,
      maxActiveClaimsales: Infinity,
      maxActiveListings: Infinity,
      maxItemsPerClaimsale: 100,
      freeHomepageSpotlightsPerMonth: 5,
    },
    features: {
      statistics: true,
      prioritySupport: true,
      customProfile: true,
      bulkUpload: true,
      vanityShopSlug: true,
      searchBoost: true,
      accountManager: false,
      extendedPriceHistory: true,
    },
  },
  ENTERPRISE: {
    key: "ENTERPRISE",
    nameKey: "tierEnterprise",
    monthlyPrice: 749,
    yearlyPrice: null,
    commissionRate: 0,
    upsellDiscount: 1,
    tierRank: 4,
    limits: {
      maxActiveAuctions: Infinity,
      maxActiveClaimsales: Infinity,
      maxActiveListings: Infinity,
      maxItemsPerClaimsale: Infinity,
      freeHomepageSpotlightsPerMonth: 999,
    },
    features: {
      statistics: true,
      prioritySupport: true,
      customProfile: true,
      bulkUpload: true,
      vanityShopSlug: true,
      searchBoost: true,
      accountManager: true,
      extendedPriceHistory: true,
    },
  },
};

export const BILLING_CYCLES = ["MONTHLY", "YEARLY"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const YEARLY_DISCOUNT = 0.17;

export const TIER_BREAK_EVENS_MONTHLY: Record<TierKey, number> = {
  FREE: 0,
  PRO: 2990,
  UNLIMITED: 5000,
  ENTERPRISE: 37500,
};

export const ENTERPRISE_MIN_MONTHLY_REVENUE = 25000;

export function getTierConfig(accountType: string): TierConfig {
  if (accountType === "ADMIN") return ACCOUNT_TIERS.ENTERPRISE;
  return ACCOUNT_TIERS[accountType as TierKey] ?? ACCOUNT_TIERS.FREE;
}

export function getCommissionRate(accountType: string): number {
  return getTierConfig(accountType).commissionRate;
}

export function getUpsellDiscount(accountType: string): number {
  return getTierConfig(accountType).upsellDiscount;
}

export function getTierRank(accountType: string): number {
  return getTierConfig(accountType).tierRank;
}

export function getMonthlyFreeUpsells(accountType: string): number {
  return getTierConfig(accountType).limits.freeHomepageSpotlightsPerMonth;
}

export function hasFeature(
  accountType: string,
  feature: keyof TierFeatures
): boolean {
  return getTierConfig(accountType).features[feature];
}

export function getTierPrice(
  tier: TierKey,
  billingCycle: BillingCycle
): number {
  const config = ACCOUNT_TIERS[tier];
  if (billingCycle === "YEARLY") {
    return config.yearlyPrice ?? config.monthlyPrice * 12;
  }
  return config.monthlyPrice;
}
