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

// Uitgelichte banner — de enige betaalde promotie voor events. Een brede
// banner (≈3:1) bovenaan de evenementenpagina (Uitgelicht-rij). Gratis events
// verschijnen als gewone vermelding; betaald = grote banner. Opgeslagen als
// EventUpsell met type "CATEGORY_HIGHLIGHT" zodat de bestaande Uitgelicht-query
// werkt.
export const EVENT_BANNER_STORED_TYPE: EventUpsellType = "CATEGORY_HIGHLIGHT";
export const EVENT_BANNER_DAILY_COST = 0.5;
export const EVENT_BANNER_MIN_DAYS = 1;
export const EVENT_BANNER_MAX_DAYS = 90;

export function calculateEventBannerCost(days: number, accountType: string): number {
  const clampedDays = Math.max(EVENT_BANNER_MIN_DAYS, Math.min(days, EVENT_BANNER_MAX_DAYS));
  const baseCost = EVENT_BANNER_DAILY_COST * clampedDays;
  const discount = getUpsellDiscount(accountType);
  return Math.round(baseCost * (1 - discount) * 100) / 100;
}

/** Aantal dagen van nu tot het einde van de gekozen datum (yyyy-MM-dd),
 *  geklemd op [MIN, MAX]. 0 als geen datum. */
export function bannerDaysUntil(dateStr: string): number {
  if (!dateStr) return 0;
  const end = new Date(`${dateStr}T23:59:59`);
  const ms = end.getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.max(EVENT_BANNER_MIN_DAYS, Math.min(Math.ceil(ms / 86_400_000), EVENT_BANNER_MAX_DAYS));
}
