import type { UpsellType } from "@/types";
import { getUpsellDiscount } from "@/lib/subscription-tiers";

export const UPSELL_PRICING: Record<
  UpsellType,
  { dailyCost: number; minDays: number; maxDays: number }
> = {
  HOMEPAGE_SPOTLIGHT: { dailyCost: 0.5, minDays: 1, maxDays: 30 },
  CATEGORY_HIGHLIGHT: { dailyCost: 0.25, minDays: 1, maxDays: 30 },
  URGENT_LABEL: { dailyCost: 0.15, minDays: 1, maxDays: 14 },
} as const;

export function calculateUpsellCost(
  type: UpsellType,
  days: number,
  accountType: string
): number {
  const config = UPSELL_PRICING[type];
  const baseCost = config.dailyCost * days;
  const discount = getUpsellDiscount(accountType);
  return Math.round(baseCost * (1 - discount) * 100) / 100;
}
