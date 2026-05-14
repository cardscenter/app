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
  // URGENT_LABEL wordt niet meer aangeboden voor auctions sinds het label-systeem
  // (src/lib/auction/labels.ts). Pricing blijft staan voor bestaande records die
  // nog actief zijn (expiresAt > now); die lopen vanzelf dood.
  URGENT_LABEL: { dailyCost: 0.25, minDays: 1, maxDays: 14 },
} as const;

// Welke upsell-types tonen we in de Promotie-sectie van /veilingen/nieuw?
// URGENT_LABEL wordt niet meer aangeboden — sellers gebruiken in plaats daarvan
// het label-systeem (Geen Reserve / Moet nu weg / etc.).
export const AUCTION_UPSELL_TYPES_OFFERED: UpsellType[] = [
  "HOMEPAGE_SPOTLIGHT",
  "CATEGORY_HIGHLIGHT",
];

// Claimsale-upsells. Naast Spotlight + Categorie-uitlichting is er een derde
// type: ITEM_PREVIEW = de 7-thumbnail-kaart-preview-strip op de /claimsales
// lijst (voorheen gratis voor iedereen, nu een betaalde upsell). Claimsales
// hebben geen vaste looptijd, dus de seller kiest puur een aantal dagen tegen
// een vast dagtarief — niet gekoppeld aan een veiling-duur.
export const CLAIMSALE_UPSELL_TYPES = [
  "HOMEPAGE_SPOTLIGHT",
  "CATEGORY_HIGHLIGHT",
  "ITEM_PREVIEW",
] as const;
export type ClaimsaleUpsellType = (typeof CLAIMSALE_UPSELL_TYPES)[number];

export const CLAIMSALE_UPSELL_PRICING: Record<
  ClaimsaleUpsellType,
  { dailyCost: number; minDays: number; maxDays: number }
> = {
  HOMEPAGE_SPOTLIGHT: { dailyCost: 0.5, minDays: 1, maxDays: 30 },
  CATEGORY_HIGHLIGHT: { dailyCost: 0.25, minDays: 1, maxDays: 30 },
  // Baseline-schatting — schappelijk dagtarief voor de preview-strip. Vóór
  // productie valideren met de productowner.
  ITEM_PREVIEW: { dailyCost: 0.2, minDays: 1, maxDays: 30 },
} as const;

export const CLAIMSALE_UPSELL_TYPES_OFFERED: ClaimsaleUpsellType[] = [
  "HOMEPAGE_SPOTLIGHT",
  "CATEGORY_HIGHLIGHT",
  "ITEM_PREVIEW",
];

export function calculateClaimsaleUpsellCost(
  type: ClaimsaleUpsellType,
  days: number,
  accountType: string
): number {
  const config = CLAIMSALE_UPSELL_PRICING[type];
  const baseCost = config.dailyCost * days;
  const discount = getUpsellDiscount(accountType);
  return Math.round(baseCost * (1 - discount) * 100) / 100;
}

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
  entries: { type: UpsellType | ClaimsaleUpsellType; days: number }[],
  accountType: string,
  freeUpsellsRemaining: number,
  context: "listing" | "auction" | "claimsale"
): { perEntry: number[]; total: number; freeUsed: number } {
  const calc =
    context === "auction"
      ? calculateAuctionUpsellCost
      : context === "claimsale"
        ? calculateClaimsaleUpsellCost
        : calculateUpsellCost;
  let freeUsed = 0;

  const perEntry = entries.map((entry) => {
    const isEligible =
      entry.type === "HOMEPAGE_SPOTLIGHT" && freeUsed < freeUpsellsRemaining;
    if (isEligible) {
      freeUsed++;
      return 0;
    }
    // calc is een van drie functies met overlappende-maar-niet-identieke
    // type-unions; de runtime-keys zijn altijd geldig voor de gekozen context.
    return calc(entry.type as UpsellType & ClaimsaleUpsellType, entry.days, accountType);
  });

  const total = Math.round(perEntry.reduce((s, c) => s + c, 0) * 100) / 100;
  return { perEntry, total, freeUsed };
}
