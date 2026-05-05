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

export const AUCTION_UPSELL_PRICING: Record<
  UpsellType,
  { dailyCost: number; minDays: number; maxDays: number }
> = {
  HOMEPAGE_SPOTLIGHT: { dailyCost: 0.75, minDays: 1, maxDays: 30 },
  CATEGORY_HIGHLIGHT: { dailyCost: 0.40, minDays: 1, maxDays: 30 },
  URGENT_LABEL: { dailyCost: 0.25, minDays: 1, maxDays: 14 },
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

export function calculateAuctionUpsellCost(
  type: UpsellType,
  days: number,
  accountType: string
): number {
  const config = AUCTION_UPSELL_PRICING[type];
  const baseCost = config.dailyCost * days;
  const discount = getUpsellDiscount(accountType);
  return Math.round(baseCost * (1 - discount) * 100) / 100;
}

// Free-quota allocator (Fase 31). Tier-abonnement geeft N gratis
// HOMEPAGE_SPOTLIGHTs per maand. We verdelen het quota greedy lineair
// over de upsell-entries: eerste eligible entry = gratis, daarna pas
// uitval.
//
// Eén quota = één entry, ongeacht z'n duur (1 dag of 30 dagen). Dat is
// genereus maar duidelijk — voorkomt verwarring "wat is een quota".
//
// Pure functie: geen DB-mutaties. Caller moet `freeUsed` zelf decrementen
// op `User.freeUpsellsRemaining` na een succesvolle creatie.
export function applyFreeUpsellsToCost(
  entries: { type: UpsellType; days: number }[],
  accountType: string,
  freeUpsellsRemaining: number,
  context: "listing" | "auction"
): { perEntry: number[]; total: number; freeUsed: number } {
  const calc = context === "auction" ? calculateAuctionUpsellCost : calculateUpsellCost;
  let freeUsed = 0;

  const perEntry = entries.map((entry) => {
    const isEligible =
      entry.type === "HOMEPAGE_SPOTLIGHT" && freeUsed < freeUpsellsRemaining;
    if (isEligible) {
      freeUsed++;
      return 0;
    }
    return calc(entry.type, entry.days, accountType);
  });

  const total = Math.round(perEntry.reduce((s, c) => s + c, 0) * 100) / 100;
  return { perEntry, total, freeUsed };
}
