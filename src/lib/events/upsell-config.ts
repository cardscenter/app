import { getUpsellDiscount } from "@/lib/subscription-tiers";

// Promotie-tarieven voor events (betaald uit intern saldo, zoals listing/auction
// upsells). Dagtarief × dagen, met tier-korting. Twee types:
// HOMEPAGE_SPOTLIGHT (homepage "Uitgelicht") + CATEGORY_HIGHLIGHT ("Uitgelicht"-
// rij bovenaan de evenementenpagina).
//
// Client-safe (geen Prisma). Prijzen zijn baseline-schattingen — vóór een echte
// launch afstemmen.

export const EVENT_UPSELL_TYPES = ["HOMEPAGE_SPOTLIGHT", "CATEGORY_HIGHLIGHT"] as const;
export type EventUpsellType = (typeof EVENT_UPSELL_TYPES)[number];

export const EVENT_UPSELL_PRICING: Record<
  EventUpsellType,
  { dailyCost: number; minDays: number; maxDays: number }
> = {
  HOMEPAGE_SPOTLIGHT: { dailyCost: 0.75, minDays: 1, maxDays: 60 },
  CATEGORY_HIGHLIGHT: { dailyCost: 0.4, minDays: 1, maxDays: 60 },
};

export const EVENT_UPSELL_LABELS_NL: Record<EventUpsellType, string> = {
  HOMEPAGE_SPOTLIGHT: "Homepage-uitlichting",
  CATEGORY_HIGHLIGHT: "Uitgelicht op evenementenpagina",
};

export function isEventUpsellType(value: string): value is EventUpsellType {
  return (EVENT_UPSELL_TYPES as readonly string[]).includes(value);
}

export function calculateEventUpsellCost(
  type: EventUpsellType,
  days: number,
  accountType: string,
): number {
  const config = EVENT_UPSELL_PRICING[type];
  const clampedDays = Math.max(config.minDays, Math.min(days, config.maxDays));
  const baseCost = config.dailyCost * clampedDays;
  const discount = getUpsellDiscount(accountType);
  return Math.round(baseCost * (1 - discount) * 100) / 100;
}
