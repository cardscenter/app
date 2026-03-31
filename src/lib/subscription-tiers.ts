export type TierKey = "FREE" | "PRO" | "UNLIMITED";

export interface TierFeatures {
  statistics: boolean;
  prioritySupport: boolean;
  customProfile: boolean;
}

export interface TierLimits {
  maxActiveAuctions: number;
  maxActiveClaimsales: number;
  maxActiveListings: number;
  maxItemsPerClaimsale: number;
}

export interface TierConfig {
  key: TierKey;
  nameKey: string;
  monthlyPrice: number;
  yearlyPrice: number;
  commissionRate: number;
  upsellDiscount: number;
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
    limits: {
      maxActiveAuctions: 1,
      maxActiveClaimsales: 1,
      maxActiveListings: 3,
      maxItemsPerClaimsale: 20,
    },
    features: {
      statistics: false,
      prioritySupport: false,
      customProfile: false,
    },
  },
  PRO: {
    key: "PRO",
    nameKey: "tierPro",
    monthlyPrice: 4.99,
    yearlyPrice: 44.91,
    commissionRate: 0.015,
    upsellDiscount: 0.25,
    limits: {
      maxActiveAuctions: 10,
      maxActiveClaimsales: 10,
      maxActiveListings: 25,
      maxItemsPerClaimsale: 50,
    },
    features: {
      statistics: true,
      prioritySupport: false,
      customProfile: false,
    },
  },
  UNLIMITED: {
    key: "UNLIMITED",
    nameKey: "tierUnlimited",
    monthlyPrice: 14.99,
    yearlyPrice: 134.91,
    commissionRate: 0,
    upsellDiscount: 0.5,
    limits: {
      maxActiveAuctions: Infinity,
      maxActiveClaimsales: Infinity,
      maxActiveListings: Infinity,
      maxItemsPerClaimsale: 100,
    },
    features: {
      statistics: true,
      prioritySupport: true,
      customProfile: true,
    },
  },
};

export const BILLING_CYCLES = ["MONTHLY", "YEARLY"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const YEARLY_DISCOUNT = 0.25;

export function getTierConfig(accountType: string): TierConfig {
  if (accountType === "ADMIN") return ACCOUNT_TIERS.UNLIMITED;
  return ACCOUNT_TIERS[accountType as TierKey] ?? ACCOUNT_TIERS.FREE;
}

export function getCommissionRate(accountType: string): number {
  return getTierConfig(accountType).commissionRate;
}

export function getUpsellDiscount(accountType: string): number {
  return getTierConfig(accountType).upsellDiscount;
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
  return billingCycle === "YEARLY" ? config.yearlyPrice : config.monthlyPrice;
}
