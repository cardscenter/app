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

// Listings (marktplaats) gebruiken hetzelfde patroon als auctions sinds de
// Fase-36-uniformisatie: Spotlight + Category Highlight + label-systeem.
// URGENT_LABEL is uitgefaseerd ten gunste van de configureerbare labels
// (src/lib/listing/labels.ts).
export const LISTING_UPSELL_TYPES_OFFERED: UpsellType[] = [
  "HOMEPAGE_SPOTLIGHT",
  "CATEGORY_HIGHLIGHT",
];

// Claimsale-upsells (flat-fee model). Drie types: Spotlight, Categorie-
// uitlichting en ITEM_PREVIEW = de "Geavanceerde Kaart-Preview-Rij" (2-rijs
// carousel met max 50 kaarten op de listing). Anders dan listing/auction-
// upsells is dit GEEN dagtarief: één eenmalige prijs voor de hele claimsale-
// looptijd, gecapt op CLAIMSALE_UPSELL_DURATION_DAYS.
//
// Prijzen zijn baseline-schattingen — vóór productie afstemmen.
export const CLAIMSALE_UPSELL_TYPES = [
  "HOMEPAGE_SPOTLIGHT",
  "CATEGORY_HIGHLIGHT",
  "ITEM_PREVIEW",
] as const;
export type ClaimsaleUpsellType = (typeof CLAIMSALE_UPSELL_TYPES)[number];

// Looptijd van een claimsale-upsell: de hele claimsale, gecapt op 14 dagen.
export const CLAIMSALE_UPSELL_DURATION_DAYS = 14;

export const CLAIMSALE_UPSELL_PRICING: Record<ClaimsaleUpsellType, { flatPrice: number }> = {
  HOMEPAGE_SPOTLIGHT: { flatPrice: 2.99 },
  CATEGORY_HIGHLIGHT: { flatPrice: 1.99 },
  ITEM_PREVIEW: { flatPrice: 1.49 },
};

export const CLAIMSALE_UPSELL_TYPES_OFFERED: ClaimsaleUpsellType[] = [
  "HOMEPAGE_SPOTLIGHT",
  "CATEGORY_HIGHLIGHT",
  "ITEM_PREVIEW",
];

// Eenmalige prijs voor de hele claimsale-looptijd; `days` wordt genegeerd
// (signatuur-compat met applyFreeUpsellsToCost).
export function calculateClaimsaleUpsellCost(
  type: ClaimsaleUpsellType,
  _days: number,
  accountType: string
): number {
  const baseCost = CLAIMSALE_UPSELL_PRICING[type].flatPrice;
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
  entries: { type: UpsellType | ClaimsaleUpsellType; days?: number }[],
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
    return calc(entry.type as UpsellType & ClaimsaleUpsellType, entry.days ?? 0, accountType);
  });

  const total = Math.round(perEntry.reduce((s, c) => s + c, 0) * 100) / 100;
  return { perEntry, total, freeUsed };
}
