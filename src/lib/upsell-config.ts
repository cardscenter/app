import type { UpsellType } from "@/types";

export const UPSELL_PRICING: Record<
  UpsellType,
  { dailyCost: number; minDays: number; maxDays: number }
> = {
  HOMEPAGE_SPOTLIGHT: { dailyCost: 0.5, minDays: 1, maxDays: 30 },
  CATEGORY_HIGHLIGHT: { dailyCost: 0.25, minDays: 1, maxDays: 30 },
  URGENT_LABEL: { dailyCost: 0.15, minDays: 1, maxDays: 14 },
} as const;

export const PREMIUM_UPSELL_DISCOUNT = 0.5; // 50% off for premium users

export function calculateUpsellCost(
  type: UpsellType,
  days: number,
  isPremium: boolean
): number {
  const config = UPSELL_PRICING[type];
  const baseCost = config.dailyCost * days;
  return isPremium ? baseCost * (1 - PREMIUM_UPSELL_DISCOUNT) : baseCost;
}
